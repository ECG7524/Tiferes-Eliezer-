import Link from 'next/link';
import { desc, eq, and, gte, sql, asc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { payments, pledges, sponsorships, seats, users, donationCategories } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getTotals, getTotalsByCategory } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';
import { todayISO, fmtDate } from '@/lib/zmanim';
import { PageHeader, Card, Stat, Badge, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayISO(tz);
  const monthStart = Math.floor(DateTime.now().setZone(tz).startOf('month').toSeconds());

  const [totals, monthTotals, byCategory, recentPayments, outstanding, openSlots, seatSummary, pendingMembers] =
    await Promise.all([
      getTotals(),
      getTotals(monthStart),
      getTotalsByCategory(),
      db
        .select({
          id: payments.id,
          donorName: payments.donorName,
          amountCents: payments.amountCents,
          method: payments.method,
          paidAt: payments.paidAt,
          category: donationCategories.name,
        })
        .from(payments)
        .leftJoin(donationCategories, eq(payments.categoryId, donationCategories.id))
        .where(eq(payments.status, 'succeeded'))
        .orderBy(desc(payments.paidAt))
        .limit(8),
      db
        .select()
        .from(pledges)
        .where(sql`${pledges.status} in ('open', 'partial')`)
        .orderBy(desc(pledges.amountCents))
        .limit(8),
      db
        .select()
        .from(sponsorships)
        .where(and(gte(sponsorships.date, today), sql`${sponsorships.status} in ('open', 'requested')`))
        .orderBy(asc(sponsorships.date))
        .limit(6),
      db
        .select({
          total: sql<number>`count(*)`,
          assigned: sql<number>`sum(case when ${seats.status} = 'assigned' then 1 else 0 end)`,
        })
        .from(seats)
        .where(eq(seats.year, 5786)),
      db.select().from(users).where(eq(users.status, 'pending')).limit(10),
    ]);

  const seatStats = seatSummary[0];

  return (
    <>
      <PageHeader
        eyebrow="Shul office"
        title="Dashboard"
        subtitle={`An overview of giving, sponsorship and membership at ${settings.nameEn}.`}
        actions={
          <>
            <Link href="/admin/donations" className="btn-ghost btn-sm">Record a payment</Link>
            <Link href="/display" className="btn-ghost btn-sm" target="_blank">Open display board ↗</Link>
          </>
        }
      />

      {pendingMembers.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong>{pendingMembers.length}</strong> account
            {pendingMembers.length === 1 ? ' is' : 's are'} waiting for approval.{' '}
            <Link href="/admin/members" className="font-semibold underline">Review them →</Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Received this month" value={formatMoney(monthTotals.receivedCents)} hint={`${monthTotals.giftCount} gifts`} tone="good" />
        <Stat label="Received all time" value={formatMoney(totals.receivedCents)} hint={`${totals.donorCount} donors`} />
        <Stat label="Outstanding pledges" value={formatMoney(totals.outstandingCents)} hint="Still to be collected" tone={totals.outstandingCents > 0 ? 'warn' : 'default'} />
        <Stat
          label="Seats taken"
          value={`${Number(seatStats?.assigned ?? 0)} / ${Number(seatStats?.total ?? 0)}`}
          hint="Current year"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Recent payments" className="lg:col-span-2" action={<Link href="/admin/donations" className="text-xs font-semibold text-gold-700 hover:underline">All →</Link>}>
          {recentPayments.length === 0 ? (
            <Empty>No payments recorded yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr><th>Donor</th><th>For</th><th>Method</th><th>Date</th><th className="text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-walnut-800">{p.donorName}</td>
                      <td className="text-walnut-500">{p.category ?? '—'}</td>
                      <td><Badge value={p.method} /></td>
                      <td className="whitespace-nowrap text-walnut-500">
                        {DateTime.fromSeconds(p.paidAt, { zone: tz }).toFormat('LLL d, yyyy')}
                      </td>
                      <td className="text-right font-semibold tabular-nums text-walnut-800">
                        {formatMoney(p.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="By fund">
          {byCategory.length === 0 ? (
            <Empty>No funds set up yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {byCategory.slice(0, 8).map((c) => {
                const goal = c.goalCents ?? 0;
                const pct = goal > 0 ? Math.min(100, Math.round((Number(c.receivedCents) / goal) * 100)) : null;
                return (
                  <li key={c.categoryId}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-walnut-700">{c.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-walnut-800">
                        {formatMoney(Number(c.receivedCents))}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gold-100">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Largest outstanding pledges" action={<Link href="/admin/donations" className="text-xs font-semibold text-gold-700 hover:underline">Manage →</Link>}>
          {outstanding.length === 0 ? (
            <Empty>Nothing outstanding — everything pledged has been collected.</Empty>
          ) : (
            <table className="table-shul">
              <tbody>
                {outstanding.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="block font-medium text-walnut-800">{p.donorName}</span>
                      {p.occasion && <span className="block text-xs text-walnut-400">{p.occasion}</span>}
                    </td>
                    <td><Badge value={p.status} /></td>
                    <td className="text-right font-semibold tabular-nums text-walnut-800">
                      {formatMoney(p.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Upcoming kiddush & seudos" action={<Link href="/admin/sponsorships" className="text-xs font-semibold text-gold-700 hover:underline">Manage →</Link>}>
          {openSlots.length === 0 ? (
            <Empty>Nothing on the calendar. Open some dates for sponsorship.</Empty>
          ) : (
            <table className="table-shul">
              <tbody>
                {openSlots.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap text-walnut-600">{fmtDate(s.date, tz, 'LLL d')}</td>
                    <td className="capitalize text-walnut-700">{s.kind.replace(/_/g, ' ')}</td>
                    <td className="text-walnut-500">{s.sponsorName || <span className="text-walnut-400">—</span>}</td>
                    <td className="text-right"><Badge value={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
