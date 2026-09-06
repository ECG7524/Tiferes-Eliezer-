'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { aliyos, pledges, users } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';
import { computeZmanim } from '@/lib/zmanim';
import { recalcPledge } from '@/lib/ledger';
import { ALIYAH_LABELS } from '@/lib/aliyos';

function fail(msg: string): never {
  redirect(`/admin/aliyos?error=${encodeURIComponent(msg)}`);
}

/** Records who got which aliyah and what they undertook to give for it. */
export async function saveAliyahAction(formData: FormData) {
  const staff = await requireRole('gabbai');
  const settings = await getSettings();

  const id = Number(formData.get('id')) || null;
  const date = String(formData.get('date') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Choose a valid date.');

  const recipientUserId = Number(formData.get('recipientUserId')) || null;
  let recipientName = String(formData.get('recipientName') ?? '').trim();
  if (recipientUserId && !recipientName) {
    const [u] = await db.select().from(users).where(eq(users.id, recipientUserId)).limit(1);
    if (u) recipientName = `${u.firstName} ${u.lastName}`;
  }
  if (!recipientName) fail('Enter who received the aliyah.');

  // Fill the parsha in from the calendar so the gabbai never has to type it.
  let parsha = String(formData.get('parsha') ?? '').trim();
  if (!parsha) {
    const { info } = computeZmanim(date, settings);
    parsha = info.parsha ?? '';
  }

  const amountCents = parseMoneyToCents(String(formData.get('amountCents') ?? '')) ?? 0;

  const values = {
    date,
    parsha,
    occasionLabel: String(formData.get('occasionLabel') ?? '').trim(),
    aliyah: String(formData.get('aliyah') ?? 'kohen') as 'kohen',
    recipientUserId,
    recipientName,
    amountCents,
    status: String(formData.get('status') ?? 'pledged') as 'pledged',
    notes: String(formData.get('notes') ?? '').trim(),
  };

  if (id) {
    await db.update(aliyos).set(values).where(eq(aliyos.id, id));
  } else {
    const [row] = await db.insert(aliyos).values(values).returning();

    // An aliyah with money attached becomes a pledge like any other, so it
    // shows up in the donor's history and in the outstanding list.
    if (amountCents > 0 && formData.get('createPledge') === 'on') {
      const label = ALIYAH_LABELS[values.aliyah]?.en ?? values.aliyah;
      const [pledge] = await db
        .insert(pledges)
        .values({
          userId: recipientUserId,
          donorName: recipientName,
          amountCents,
          occasion: `${label}${parsha ? ` · Parashas ${parsha}` : ''}`,
          status: 'open',
          notes: `Aliyah on ${date}`,
          createdById: staff.id,
        })
        .returning();
      await db.update(aliyos).set({ pledgeId: pledge.id }).where(eq(aliyos.id, row.id));
    }
  }

  revalidatePath('/admin/aliyos');
  redirect(`/admin/aliyos?date=${date}&ok=` + encodeURIComponent('Aliyah recorded.'));
}

export async function deleteAliyahAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  const [row] = await db.select().from(aliyos).where(eq(aliyos.id, id)).limit(1);
  if (row) {
    await db.delete(aliyos).where(eq(aliyos.id, id));
    if (row.pledgeId) await recalcPledge(row.pledgeId);
  }
  revalidatePath('/admin/aliyos');
  redirect(`/admin/aliyos?date=${row?.date ?? ''}&ok=` + encodeURIComponent('Removed.'));
}
