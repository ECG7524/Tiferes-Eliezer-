import Link from 'next/link';
import { desc, eq, asc, sql, and, gte, lte, or, like } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { payments, pledges, donationCategories, users } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { getTotals } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';
import { recordPaymentAction, createPledgeAction, cancelPledgeAction, deletePaymentAction } from '@/actions/donations';
import { PageHeader, Card, Stat, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

const METHODS = ['cash', 'check', 'zelle', 'quickpay', 'card', 'other'] as const;

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string; from?: string; to?: string; tab?: string }>;
}) {
  const [sp, settings, me] = await Promise.all([searchParams, getSettings(), getCurrentUser()]);
  const tz = settings.timezone;
  const tab = sp.tab === 'pledges' ? 'pledges' : 'payments';

  const fromUnix = sp.from ? Math.floor(new Date(`${sp.from}T00:00:00`).getTime() / 1000) : null;
  const toUnix = sp.to ? Math.floor(new Date(`${sp.to}T23:59:59`).getTime() / 1000) : null;
  const q = (sp.q ?? '').trim();

  const paymentFilters = [
    ...(fromUnix ? [gte(payments.paidAt, fromUnix)] : []),
    ...(toUnix ? [lte(payments.paidAt, toUnix)] : []),
    ...(q ? [or(like(payments.donorName, `%${q}%`), like(payments.donorEmail, `%${q}%`), like(payments.reference, `%${q}%`))!] : []),
  ];

  const [totals, categories, members, paymentRows, pledgeRows] = await Promise.all([
    getTotals(fromUnix ?? undefined),
    db.select().from(donationCategories).orderBy(asc(donationCategories.sortOrder), asc(donationCategories.name)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.status, 'active')).orderBy(asc(users.lastName)),
    db
      .select({
        payment: payments,
        category: donationCategories.name,
      })
      .from(payments)
      .leftJoin(donationCategories, eq(payments.categoryId, donationCategories.id))
      .where(paymentFilters.length ? and(...paymentFilters) : undefined)
      .orderBy(desc(payments.paidAt))
      .limit(250),
    db
      .select({
        pledge: pledges,
        category: donationCategories.name,
        paid: sql<number>`(
          select coalesce(sum(p2.amount_cents), 0) from payments p2
          where p2.pledge_id = ${pledges.id} and p2.status = 'succeeded'
        )`,
      })
      .from(pledges)
      .leftJoin(donationCategories, eq(pledges.categoryId, donationCategories.id))
      .where(q ? like(pledges.donorName, `%${q}%`) : undefined)
      .orderBy(desc(pledges.createdAt))
      .limit(250),
  ]);

  const exportQuery = new URLSearchParams({
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
    ...(q ? { q } : {}),
  }).toString();

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Donations"
        subtitle="Every gift the shul receives — card, cash, cheque or Zelle — lives here, alongside the pledges still to be collected."
        actions={
          <a href={`/admin/donations/export?${exportQuery}`} className="btn-ghost btn-sm">Export CSV</a>
        }
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={fromUnix ? 'Received in range' : 'Received all time'} value={formatMoney(totals.receivedCents)} hint={`${totals.giftCount} gifts`} tone="good" />
        <Stat label="Pledged, still open" value={formatMoney(totals.pledgedCents)} />
        <Stat label="Outstanding" value={formatMoney(totals.outstandingCents)} tone={totals.outstandingCents > 0 ? 'warn' : 'default'} />
      </div>

      {/* ---------- Entry forms ---------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Record a payment" titleHe="קבלה">
          <form action={recordPaymentAction} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pay-pledge">Settling a pledge? <span className="normal-case text-walnut-400">(optional)</span></label>
              <select id="pay-pledge" name="pledgeId" className="select">
                <option value="">— Standalone gift —</option>
                {pledgeRows
                  .filter((r) => r.pledge.status === 'open' || r.pledge.status === 'partial')
                  .map((r) => (
                    <option key={r.pledge.id} value={r.pledge.id}>
                      #{r.pledge.id} · {r.pledge.donorName} · {formatMoney(r.pledge.amountCents - Number(r.paid))} outstanding
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay-name">Donor name</label>
              <input id="pay-name" name="donorName" className="input" placeholder="Leave blank to use the pledge's name" />
            </div>
            <div>
              <label className="label" htmlFor="pay-amount">Amount</label>
              <input id="pay-amount" name="amountCents" required inputMode="decimal" placeholder="180" className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="pay-method">Method</label>
              <select id="pay-method" name="method" className="select">
                {METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay-ref">Reference</label>
              <input id="pay-ref" name="reference" className="input" placeholder="Cheque no. / confirmation" />
            </div>
            <div>
              <label className="label" htmlFor="pay-cat">Fund</label>
              <select id="pay-cat" name="categoryId" className="select">
                <option value="">— Not specified —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay-date">Date received</label>
              <input id="pay-date" name="paidAt" type="date" defaultValue={DateTime.now().setZone(tz).toISODate()!} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pay-member">Link to member <span className="normal-case text-walnut-400">(optional)</span></label>
              <select id="pay-member" name="userId" className="select">
                <option value="">— Not linked —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary w-full">Record payment</button>
            </div>
          </form>
        </Card>

        <Card title="Book a pledge" titleHe="התחייבות">
          <form action={createPledgeAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pl-name">Donor name</label>
              <input id="pl-name" name="donorName" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pl-amount">Amount</label>
              <input id="pl-amount" name="amountCents" required inputMode="decimal" placeholder="1800" className="input tabular-nums" />
            </div>
            <div>
              <label className="label" htmlFor="pl-email">Email</label>
              <input id="pl-email" name="donorEmail" type="email" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pl-phone">Phone</label>
              <input id="pl-phone" name="donorPhone" type="tel" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pl-cat">Fund</label>
              <select id="pl-cat" name="categoryId" className="select">
                <option value="">— Not specified —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pl-due">Due by</label>
              <input id="pl-due" name="dueDate" type="date" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pl-occ">Occasion</label>
              <input id="pl-occ" name="occasion" className="input" placeholder="Aliyah on Shabbos · Kiddush · לזכר נשמת…" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pl-member">Link to member <span className="normal-case text-walnut-400">(optional)</span></label>
              <select id="pl-member" name="userId" className="select">
                <option value="">— Not linked —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-ghost w-full">Book pledge</button>
            </div>
          </form>
        </Card>
      </div>

      {/* ---------- Filters ---------- */}
      <form action="/admin/donations" className="mt-8 flex flex-wrap items-end gap-3 no-print">
        <input type="hidden" name="tab" value={tab} />
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="f-q">Search</label>
          <input id="f-q" name="q" defaultValue={q} placeholder="Donor name, email or reference" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="f-from">From</label>
          <input id="f-from" name="from" type="date" defaultValue={sp.from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="f-to">To</label>
          <input id="f-to" name="to" type="date" defaultValue={sp.to} className="input" />
        </div>
        <button type="submit" className="btn-ghost">Filter</button>
        {(q || sp.from || sp.to) && <Link href="/admin/donations" className="btn-ghost">Clear</Link>}
      </form>

      {/* ---------- Tabs ---------- */}
      <div className="mt-6 flex gap-1 border-b border-gold-200 no-print">
        {(['payments', 'pledges'] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/donations?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold capitalize ${
              tab === t ? 'border-gold-500 text-walnut-800' : 'border-transparent text-walnut-400 hover:text-walnut-600'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'payments' ? (
          paymentRows.length === 0 ? (
            <Empty>No payments match.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr>
                    <th>Date</th><th>Donor</th><th>Fund</th><th>Method</th><th>Reference</th>
                    <th className="text-right">Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map(({ payment: p, category }) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-walnut-500">
                        {DateTime.fromSeconds(p.paidAt, { zone: tz }).toFormat('LLL d, yyyy')}
                      </td>
                      <td>
                        <span className="block font-medium text-walnut-800">{p.donorName}</span>
                        {p.pledgeId && <span className="text-xs text-walnut-400">against pledge #{p.pledgeId}</span>}
                      </td>
                      <td className="text-walnut-500">{category ?? '—'}</td>
                      <td><Badge value={p.method} /></td>
                      <td className="text-xs text-walnut-400">{p.reference || '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-walnut-800">{formatMoney(p.amountCents)}</td>
                      <td className="text-right">
                        {me?.role === 'admin' && (
                          <form action={deletePaymentAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs text-rose-600 hover:underline">Delete</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : pledgeRows.length === 0 ? (
          <Empty>No pledges match.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-shul">
              <thead>
                <tr>
                  <th>#</th><th>Donor</th><th>Fund</th><th>Occasion</th><th>Status</th>
                  <th className="text-right">Pledged</th><th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pledgeRows.map(({ pledge: p, category, paid }) => {
                  const outstanding = Math.max(0, p.amountCents - Number(paid));
                  return (
                    <tr key={p.id}>
                      <td className="tabular-nums text-walnut-400">{p.id}</td>
                      <td>
                        <span className="block font-medium text-walnut-800">{p.donorName}</span>
                        {p.donorEmail && <span className="text-xs text-walnut-400">{p.donorEmail}</span>}
                      </td>
                      <td className="text-walnut-500">{category ?? '—'}</td>
                      <td className="max-w-[16rem] truncate text-walnut-500">{p.occasion || '—'}</td>
                      <td><Badge value={p.status} /></td>
                      <td className="text-right tabular-nums text-walnut-700">{formatMoney(p.amountCents)}</td>
                      <td className="text-right tabular-nums text-emerald-700">{formatMoney(Number(paid))}</td>
                      <td className="text-right font-semibold tabular-nums text-walnut-800">
                        {outstanding > 0 ? formatMoney(outstanding) : '—'}
                      </td>
                      <td className="text-right">
                        {p.status !== 'cancelled' && p.status !== 'paid' && (
                          <form action={cancelPledgeAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Cancel</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
