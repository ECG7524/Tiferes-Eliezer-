'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sponsorships, pledges } from '@/db/schema';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';
import { computeZmanim, addDaysISO, todayISO } from '@/lib/zmanim';

const KIND_DEFAULTS: Record<string, 'defaultKiddushCents' | 'defaultShaloshSeudosCents'> = {
  kiddush: 'defaultKiddushCents',
  shalosh_seudas: 'defaultShaloshSeudosCents',
  shalosh_seudos: 'defaultShaloshSeudosCents',
};

function fail(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

/**
 * A member claiming an open slot. It lands as `requested` rather than
 * `confirmed` so a gabbai still has the final say over the shul's calendar.
 */
export async function requestSponsorshipAction(formData: FormData) {
  const user = await getCurrentUser();
  const settings = await getSettings();

  const id = Number(formData.get('id'));
  const [slot] = await db.select().from(sponsorships).where(eq(sponsorships.id, id)).limit(1);
  if (!slot) fail('/sponsor', 'That date is no longer listed.');
  if (slot.status !== 'open') fail('/sponsor', 'Someone has already taken that date. Please choose another.');

  const sponsorName = String(formData.get('sponsorName') ?? '').trim()
    || (user ? `${user.firstName} ${user.lastName}` : '');
  if (!sponsorName) fail('/sponsor', 'Please give the name this sponsorship should be listed under.');

  const occasion = String(formData.get('occasion') ?? '').trim();
  const amountCents =
    parseMoneyToCents(String(formData.get('amountCents') ?? '')) ??
    settings[KIND_DEFAULTS[slot.kind] ?? 'defaultKiddushCents'];

  // The sponsorship is money owed, so it gets a pledge in the same ledger as
  // everything else rather than living off on its own.
  const [pledge] = await db
    .insert(pledges)
    .values({
      userId: user?.id ?? null,
      donorName: sponsorName,
      donorEmail: String(formData.get('donorEmail') ?? '').trim() || user?.email || '',
      donorPhone: String(formData.get('donorPhone') ?? '').trim(),
      amountCents,
      occasion,
      status: 'open',
      notes: `${slot.kind.replace(/_/g, ' ')} — ${slot.date}`,
      createdById: user?.id ?? null,
    })
    .returning();

  await db
    .update(sponsorships)
    .set({
      sponsorUserId: user?.id ?? null,
      sponsorName,
      occasion,
      amountCents,
      pledgeId: pledge.id,
      status: 'requested',
    })
    .where(eq(sponsorships.id, id));

  revalidatePath('/sponsor');
  revalidatePath('/admin/sponsorships');
  redirect('/sponsor?ok=' + encodeURIComponent('Thank you — the shul office will confirm your sponsorship shortly.'));
}

/* ---------------- Office side ---------------- */

export async function saveSponsorshipAction(formData: FormData) {
  await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const date = String(formData.get('date') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('/admin/sponsorships', 'Choose a valid date.');

  const values = {
    kind: String(formData.get('kind') ?? 'kiddush') as 'kiddush',
    date,
    label: String(formData.get('label') ?? '').trim(),
    sponsorName: String(formData.get('sponsorName') ?? '').trim(),
    occasion: String(formData.get('occasion') ?? '').trim(),
    amountCents: parseMoneyToCents(String(formData.get('amountCents') ?? '')) ?? 0,
    status: String(formData.get('status') ?? 'open') as 'open',
    coSponsors: String(formData.get('coSponsors') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
  };

  if (id) {
    await db.update(sponsorships).set(values).where(eq(sponsorships.id, id));
  } else {
    await db.insert(sponsorships).values(values);
  }

  revalidatePath('/admin/sponsorships');
  revalidatePath('/sponsor');
  redirect('/admin/sponsorships?ok=' + encodeURIComponent('Saved.'));
}

export async function deleteSponsorshipAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) await db.delete(sponsorships).where(eq(sponsorships.id, id));
  revalidatePath('/admin/sponsorships');
  redirect('/admin/sponsorships?ok=' + encodeURIComponent('Removed.'));
}

/**
 * Fills the calendar forward with empty Shabbos slots so members always have
 * something to claim, labelled with the parsha of the week.
 */
export async function generateSlotsAction(formData: FormData) {
  await requireRole('gabbai');
  const settings = await getSettings();
  const weeks = Math.min(52, Math.max(1, Number(formData.get('weeks')) || 12));
  const kinds = formData.getAll('kinds').map(String).filter(Boolean);
  if (kinds.length === 0) fail('/admin/sponsorships', 'Choose at least one kind of sponsorship to open up.');

  const tz = settings.timezone;
  let iso = todayISO(tz);
  let created = 0;

  // Walk forward to the coming Shabbos, then a week at a time.
  for (let guard = 0; guard < 7; guard++) {
    const { info } = computeZmanim(iso, settings);
    if (info.isShabbos) break;
    iso = addDaysISO(iso, 1, tz);
  }

  for (let w = 0; w < weeks; w++) {
    const { info } = computeZmanim(iso, settings);
    const label = info.parsha ? `Parashas ${info.parsha}` : info.holidays[0]?.en ?? '';

    for (const kind of kinds) {
      const existing = await db
        .select({ id: sponsorships.id })
        .from(sponsorships)
        .where(and(eq(sponsorships.date, iso), eq(sponsorships.kind, kind as 'kiddush')))
        .limit(1);

      if (!existing[0]) {
        const defaultKey = KIND_DEFAULTS[kind] ?? 'defaultKiddushCents';
        await db.insert(sponsorships).values({
          kind: kind as 'kiddush',
          date: iso,
          label,
          amountCents: settings[defaultKey],
          status: 'open',
        });
        created++;
      }
    }

    iso = addDaysISO(iso, 7, tz);
  }

  revalidatePath('/admin/sponsorships');
  revalidatePath('/sponsor');
  redirect('/admin/sponsorships?ok=' + encodeURIComponent(`Opened ${created} new slot${created === 1 ? '' : 's'}.`));
}
