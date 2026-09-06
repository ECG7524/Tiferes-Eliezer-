'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { seats, pledges, users } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';

function fail(msg: string): never {
  redirect(`/admin/seats?error=${encodeURIComponent(msg)}`);
}

/** Lays out a block of seats in one go rather than one row at a time. */
export async function generateSeatsAction(formData: FormData) {
  await requireRole('gabbai');
  const settings = await getSettings();

  const section = String(formData.get('section') ?? '').trim() || 'Main';
  const year = Number(formData.get('year')) || 5786;
  const rowsRaw = String(formData.get('rows') ?? '').trim();
  const perRow = Number(formData.get('perRow')) || 0;
  const priceCents = parseMoneyToCents(String(formData.get('priceCents') ?? '')) ?? settings.defaultSeatCents;

  if (!rowsRaw) fail('List the rows, for example: A, B, C');
  if (perRow < 1 || perRow > 100) fail('Seats per row must be between 1 and 100.');

  const rows = rowsRaw.split(/[,\s]+/).map((r) => r.trim().toUpperCase()).filter(Boolean);
  if (rows.length === 0) fail('List at least one row.');

  let created = 0;
  for (const row of rows) {
    for (let n = 1; n <= perRow; n++) {
      const existing = await db
        .select({ id: seats.id })
        .from(seats)
        .where(and(eq(seats.year, year), eq(seats.section, section), eq(seats.row, row), eq(seats.number, n)))
        .limit(1);
      if (existing[0]) continue;

      await db.insert(seats).values({ section, row, number: n, year, priceCents, status: 'available' });
      created++;
    }
  }

  revalidatePath('/admin/seats');
  redirect(`/admin/seats?year=${year}&ok=` + encodeURIComponent(`Added ${created} seat${created === 1 ? '' : 's'}.`));
}

/** Assigns a seat to a member and books the money owed as a pledge. */
export async function assignSeatAction(formData: FormData) {
  const staff = await requireRole('gabbai');

  const id = Number(formData.get('id'));
  const [seat] = await db.select().from(seats).where(eq(seats.id, id)).limit(1);
  if (!seat) fail('That seat no longer exists.');

  const holderUserId = Number(formData.get('holderUserId')) || null;
  let holderName = String(formData.get('holderName') ?? '').trim();

  if (holderUserId && !holderName) {
    const [u] = await db.select().from(users).where(eq(users.id, holderUserId)).limit(1);
    if (u) holderName = `${u.firstName} ${u.lastName}`;
  }
  if (!holderName) fail('Enter who the seat is for.');

  const priceCents = parseMoneyToCents(String(formData.get('priceCents') ?? '')) ?? seat.priceCents;
  const createPledge = formData.get('createPledge') === 'on';

  let pledgeId = seat.pledgeId;
  if (createPledge && priceCents > 0) {
    const [pledge] = await db
      .insert(pledges)
      .values({
        userId: holderUserId,
        donorName: holderName,
        amountCents: priceCents,
        occasion: `Seat ${seat.section} ${seat.row}${seat.number} · ${seat.year}`,
        status: 'open',
        createdById: staff.id,
      })
      .returning();
    pledgeId = pledge.id;
  }

  await db
    .update(seats)
    .set({
      holderUserId,
      holderName,
      priceCents,
      pledgeId,
      status: 'assigned',
      notes: String(formData.get('notes') ?? '').trim(),
    })
    .where(eq(seats.id, id));

  revalidatePath('/admin/seats');
  redirect(`/admin/seats?year=${seat.year}&ok=` + encodeURIComponent('Seat assigned.'));
}

export async function releaseSeatAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  const [seat] = await db.select().from(seats).where(eq(seats.id, id)).limit(1);
  if (!seat) redirect('/admin/seats');

  // The pledge stays in the ledger; only the seat is freed up.
  await db
    .update(seats)
    .set({ holderUserId: null, holderName: '', pledgeId: null, status: 'available' })
    .where(eq(seats.id, id));

  revalidatePath('/admin/seats');
  redirect(`/admin/seats?year=${seat.year}&ok=` + encodeURIComponent('Seat released.'));
}

export async function deleteSeatAction(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('id'));
  const [seat] = await db.select().from(seats).where(eq(seats.id, id)).limit(1);
  if (seat) await db.delete(seats).where(eq(seats.id, id));
  revalidatePath('/admin/seats');
  redirect(`/admin/seats?year=${seat?.year ?? ''}&ok=` + encodeURIComponent('Seat removed.'));
}

/**
 * Carries a year's seating chart over to the next year, keeping who sits where
 * but starting everyone's payment fresh.
 */
export async function rolloverSeatsAction(formData: FormData) {
  await requireRole('gabbai');
  const fromYear = Number(formData.get('fromYear'));
  const toYear = Number(formData.get('toYear'));
  if (!fromYear || !toYear || fromYear === toYear) fail('Choose two different years.');

  const source = await db.select().from(seats).where(eq(seats.year, fromYear));
  if (source.length === 0) fail(`There are no seats recorded for ${fromYear}.`);

  const keepHolders = formData.get('keepHolders') === 'on';
  let created = 0;

  for (const s of source) {
    const existing = await db
      .select({ id: seats.id })
      .from(seats)
      .where(and(eq(seats.year, toYear), eq(seats.section, s.section), eq(seats.row, s.row), eq(seats.number, s.number)))
      .limit(1);
    if (existing[0]) continue;

    await db.insert(seats).values({
      section: s.section,
      row: s.row,
      number: s.number,
      label: s.label,
      priceCents: s.priceCents,
      year: toYear,
      holderUserId: keepHolders ? s.holderUserId : null,
      holderName: keepHolders ? s.holderName : '',
      // Payment starts over each year, so no pledge carries across.
      pledgeId: null,
      status: keepHolders && s.status === 'assigned' ? 'assigned' : 'available',
    });
    created++;
  }

  revalidatePath('/admin/seats');
  redirect(`/admin/seats?year=${toYear}&ok=` + encodeURIComponent(`Carried ${created} seat${created === 1 ? '' : 's'} over to ${toYear}.`));
}
