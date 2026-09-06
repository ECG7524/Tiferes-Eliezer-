'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { pledges, payments, donationCategories, users } from '@/db/schema';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';
import { getStripe, isStripeEnabled, siteUrl } from '@/lib/stripe';
import { recalcPledge } from '@/lib/ledger';

const MIN_CENTS = 100;
const MAX_CENTS = 100_000_00; // $100,000 — a sanity ceiling on a public form.

function fail(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

/**
 * The public giving form. Creates the pledge either way; if the donor chose to
 * pay by card we hand them off to Stripe Checkout and the webhook records the
 * payment when it settles.
 */
export async function donateAction(formData: FormData) {
  const settings = await getSettings();
  const user = await getCurrentUser();

  const categoryId = Number(formData.get('categoryId'));
  const amountCents = parseMoneyToCents(
    String(formData.get('amount') || formData.get('presetAmount') || ''),
  );
  const payNow = String(formData.get('payNow') ?? 'card') === 'card';

  const schema = z.object({
    donorName: z.string().trim().min(1, 'Please enter the name this gift should be recorded under.'),
    donorEmail: z.string().trim().toLowerCase().email('Please enter a valid email address.').or(z.literal('')),
    donorPhone: z.string().trim().default(''),
    occasion: z.string().trim().max(200).default(''),
    dedication: z.string().trim().max(500).default(''),
  });

  const parsed = schema.safeParse({
    donorName: formData.get('donorName') || (user ? `${user.firstName} ${user.lastName}` : ''),
    donorEmail: formData.get('donorEmail') || user?.email || '',
    donorPhone: formData.get('donorPhone') ?? '',
    occasion: formData.get('occasion') ?? '',
    dedication: formData.get('dedication') ?? '',
  });

  if (!parsed.success) fail('/donate', parsed.error.errors[0].message);
  if (amountCents === null || amountCents < MIN_CENTS) fail('/donate', 'Please enter an amount of at least $1.');
  if (amountCents > MAX_CENTS) fail('/donate', 'For a gift this size please contact the shul office directly — we would rather handle it personally.');

  const [category] = await db
    .select()
    .from(donationCategories)
    .where(eq(donationCategories.id, categoryId))
    .limit(1);
  if (!category || !category.active) fail('/donate', 'Please choose what your gift is for.');

  const d = parsed.data;
  const [pledge] = await db
    .insert(pledges)
    .values({
      userId: user?.id ?? null,
      donorName: d.donorName,
      donorEmail: d.donorEmail,
      donorPhone: d.donorPhone,
      categoryId: category.id,
      amountCents,
      occasion: d.occasion,
      dedication: d.dedication,
      anonymous: formData.get('anonymous') === 'on',
      status: 'open',
      createdById: user?.id ?? null,
    })
    .returning();

  // Pledge now, pay later — the office will follow up.
  if (!payNow || !isStripeEnabled()) {
    revalidatePath('/admin/donations');
    redirect(`/donate/thank-you?pledge=${pledge.id}`);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Stripe emails its own receipt to this address.
    customer_email: d.donorEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: settings.currency,
          unit_amount: amountCents,
          product_data: {
            name: `${category.name} — ${settings.nameEn}`,
            description: d.occasion || category.description || undefined,
          },
        },
      },
    ],
    // The webhook trusts this, not anything the browser sends back.
    metadata: {
      pledgeId: String(pledge.id),
      categoryId: String(category.id),
      userId: user ? String(user.id) : '',
    },
    success_url: `${siteUrl()}/donate/thank-you?pledge=${pledge.id}&paid=1`,
    cancel_url: `${siteUrl()}/donate?error=${encodeURIComponent('Your payment was cancelled — nothing has been charged.')}`,
  });

  await db.update(pledges).set({ notes: `Stripe checkout ${session.id}` }).where(eq(pledges.id, pledge.id));

  if (!session.url) fail('/donate', 'Could not start the payment. Please try again.');
  redirect(session.url);
}

/* ------------------------------------------------------------------ */
/* Office-side ledger entry                                            */
/* ------------------------------------------------------------------ */

/** Records money that arrived outside of Stripe: cash, a cheque, Zelle. */
export async function recordPaymentAction(formData: FormData) {
  const staff = await requireRole('gabbai');

  const amountCents = parseMoneyToCents(String(formData.get('amountCents') ?? ''));
  if (amountCents === null || amountCents <= 0) fail('/admin/donations', 'Enter a valid amount.');

  const pledgeIdRaw = String(formData.get('pledgeId') ?? '');
  const pledgeId = pledgeIdRaw ? Number(pledgeIdRaw) : null;

  let categoryId = Number(formData.get('categoryId')) || null;
  let donorName = String(formData.get('donorName') ?? '').trim();
  let userId = Number(formData.get('userId')) || null;

  // When it is settling an existing pledge, inherit the pledge's own details.
  if (pledgeId) {
    const [p] = await db.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
    if (!p) fail('/admin/donations', 'That pledge no longer exists.');
    categoryId ??= p.categoryId;
    userId ??= p.userId;
    if (!donorName) donorName = p.donorName;
  }

  if (!donorName) fail('/admin/donations', 'Enter the donor name.');

  const paidAtRaw = String(formData.get('paidAt') ?? '');
  const paidAt = paidAtRaw
    ? Math.floor(new Date(`${paidAtRaw}T12:00:00`).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  await db.insert(payments).values({
    pledgeId,
    userId,
    donorName,
    donorEmail: String(formData.get('donorEmail') ?? '').trim(),
    categoryId,
    amountCents,
    method: (String(formData.get('method') ?? 'cash') as 'cash'),
    reference: String(formData.get('reference') ?? '').trim(),
    status: 'succeeded',
    paidAt,
    notes: String(formData.get('notes') ?? '').trim(),
    recordedById: staff.id,
  });

  if (pledgeId) await recalcPledge(pledgeId);

  revalidatePath('/admin/donations');
  revalidatePath('/admin');
  redirect('/admin/donations?ok=' + encodeURIComponent('Payment recorded.'));
}

/** Books a pledge on someone's behalf — the phone call the gabbai just took. */
export async function createPledgeAction(formData: FormData) {
  const staff = await requireRole('gabbai');

  const amountCents = parseMoneyToCents(String(formData.get('amountCents') ?? ''));
  if (amountCents === null || amountCents <= 0) fail('/admin/donations', 'Enter a valid amount.');

  const donorName = String(formData.get('donorName') ?? '').trim();
  if (!donorName) fail('/admin/donations', 'Enter the donor name.');

  await db.insert(pledges).values({
    userId: Number(formData.get('userId')) || null,
    donorName,
    donorEmail: String(formData.get('donorEmail') ?? '').trim(),
    donorPhone: String(formData.get('donorPhone') ?? '').trim(),
    categoryId: Number(formData.get('categoryId')) || null,
    amountCents,
    occasion: String(formData.get('occasion') ?? '').trim(),
    dueDate: String(formData.get('dueDate') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
    status: 'open',
    createdById: staff.id,
  });

  revalidatePath('/admin/donations');
  redirect('/admin/donations?ok=' + encodeURIComponent('Pledge recorded.'));
}

export async function cancelPledgeAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) await db.update(pledges).set({ status: 'cancelled' }).where(eq(pledges.id, id));
  revalidatePath('/admin/donations');
  redirect('/admin/donations?ok=' + encodeURIComponent('Pledge cancelled.'));
}

export async function deletePaymentAction(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('id'));
  if (!id) redirect('/admin/donations');

  const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  await db.delete(payments).where(eq(payments.id, id));
  if (row?.pledgeId) await recalcPledge(row.pledgeId);

  revalidatePath('/admin/donations');
  redirect('/admin/donations?ok=' + encodeURIComponent('Payment removed.'));
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function saveCategoryAction(formData: FormData) {
  await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) fail('/admin/categories', 'Give the fund a name.');

  const slug =
    String(formData.get('slug') ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const suggested = String(formData.get('suggestedAmounts') ?? '')
    .split(',')
    .map((v) => parseMoneyToCents(v.trim()))
    .filter((v): v is number => v !== null && v > 0);

  const values = {
    slug,
    name,
    nameHe: String(formData.get('nameHe') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    kind: (String(formData.get('kind') ?? 'general') as 'general'),
    suggestedAmounts: JSON.stringify(suggested.length ? suggested : [1800, 3600, 5400, 10000]),
    allowCustomAmount: formData.get('allowCustomAmount') === 'on',
    goalCents: parseMoneyToCents(String(formData.get('goalCents') ?? '')) ?? 0,
    active: formData.get('active') === 'on',
    sortOrder: Number(formData.get('sortOrder')) || 0,
  };

  if (id) {
    await db.update(donationCategories).set(values).where(eq(donationCategories.id, id));
  } else {
    await db.insert(donationCategories).values(values);
  }

  revalidatePath('/admin/categories');
  revalidatePath('/donate');
  redirect('/admin/categories?ok=' + encodeURIComponent('Fund saved.'));
}

export async function deleteCategoryAction(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('id'));
  // Gifts keep their history; the fund is retired rather than erased.
  if (id) await db.update(donationCategories).set({ active: false }).where(eq(donationCategories.id, id));
  revalidatePath('/admin/categories');
  redirect('/admin/categories?ok=' + encodeURIComponent('Fund retired.'));
}

/** Type-ahead source for the "attach this gift to a member" pickers. */
export async function searchMembers(query: string) {
  const q = `%${query.toLowerCase()}%`;
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.status, 'active'))
    .limit(20);
}
