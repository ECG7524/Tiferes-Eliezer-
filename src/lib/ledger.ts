import 'server-only';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/db';
import { pledges, payments, donationCategories } from '@/db/schema';

/**
 * Re-derives a pledge's status from the payments recorded against it, so the
 * ledger never drifts out of step with the money actually received.
 */
export async function recalcPledge(pledgeId: number): Promise<void> {
  const [pledge] = await db.select().from(pledges).where(eq(pledges.id, pledgeId)).limit(1);
  if (!pledge || pledge.status === 'cancelled') return;

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.pledgeId, pledgeId), eq(payments.status, 'succeeded')));

  const paid = Number(total) || 0;
  const status = paid <= 0 ? 'open' : paid >= pledge.amountCents ? 'paid' : 'partial';

  if (status !== pledge.status) {
    await db.update(pledges).set({ status }).where(eq(pledges.id, pledgeId));
  }
}

export async function pledgePaidCents(pledgeId: number): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.pledgeId, pledgeId), eq(payments.status, 'succeeded')));
  return Number(total) || 0;
}

export interface LedgerTotals {
  receivedCents: number;
  pledgedCents: number;
  outstandingCents: number;
  giftCount: number;
  donorCount: number;
}

/** Headline numbers for the admin dashboard, optionally limited to a window. */
export async function getTotals(sinceUnix?: number): Promise<LedgerTotals> {
  const paidWhere = sinceUnix
    ? and(eq(payments.status, 'succeeded'), sql`${payments.paidAt} >= ${sinceUnix}`)
    : eq(payments.status, 'succeeded');

  const [received] = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
      count: sql<number>`count(*)`,
      donors: sql<number>`count(distinct coalesce(${payments.userId}, ${payments.donorName}))`,
    })
    .from(payments)
    .where(paidWhere);

  const [pledged] = await db
    .select({ total: sql<number>`coalesce(sum(${pledges.amountCents}), 0)` })
    .from(pledges)
    .where(sql`${pledges.status} in ('open', 'partial')`);

  const [collectedOnOpen] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .innerJoin(pledges, eq(payments.pledgeId, pledges.id))
    .where(and(eq(payments.status, 'succeeded'), sql`${pledges.status} in ('open', 'partial')`));

  const pledgedTotal = Number(pledged.total) || 0;
  const alreadyPaid = Number(collectedOnOpen.total) || 0;

  return {
    receivedCents: Number(received.total) || 0,
    pledgedCents: pledgedTotal,
    outstandingCents: Math.max(0, pledgedTotal - alreadyPaid),
    giftCount: Number(received.count) || 0,
    donorCount: Number(received.donors) || 0,
  };
}

/** Money received broken out by category, for the dashboard's roll-up. */
export async function getTotalsByCategory() {
  return db
    .select({
      categoryId: donationCategories.id,
      name: donationCategories.name,
      kind: donationCategories.kind,
      goalCents: donationCategories.goalCents,
      receivedCents: sql<number>`coalesce(sum(case when ${payments.status} = 'succeeded' then ${payments.amountCents} else 0 end), 0)`,
      giftCount: sql<number>`count(${payments.id})`,
    })
    .from(donationCategories)
    .leftJoin(payments, eq(payments.categoryId, donationCategories.id))
    .groupBy(donationCategories.id)
    .orderBy(desc(sql`coalesce(sum(case when ${payments.status} = 'succeeded' then ${payments.amountCents} else 0 end), 0)`));
}
