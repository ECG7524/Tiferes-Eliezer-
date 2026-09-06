import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, desc, and, sql, asc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { payments, pledges, seats, yahrzeits, donationCategories, aliyos, sponsorships } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { yahrzeitInYear, todayISO, fmtDate } from '@/lib/zmanim';
import { HEBREW_MONTHS, hebrewMonthLabel, currentHebrewYear } from '@/lib/hebrewMonths';
import { logoutAction } from '@/actions/auth';
import { updateProfileAction, changePasswordAction } from '@/actions/admin';
import { saveYahrzeitAction, deleteYahrzeitAction } from '@/actions/content';
import { PageHeader, Card, Stat, Badge, Empty, Flash } from '@/components/ui';
import { ALIYAH_LABELS } from '@/lib/aliyos';

export const metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [sp, user, settings] = await Promise.all([searchParams, getCurrentUser(), getSettings()]);
  if (!user) redirect('/login?next=/account');

  const tz = settings.timezone;
  const today = todayISO(tz);
  const thisHebrewYear = currentHebrewYear();

  const [myPayments, myPledges, mySeats, myYahrzeits, myAliyos, mySponsorships, totals] = await Promise.all([
    db
      .select({ payment: payments, category: donationCategories.name })
      .from(payments)
      .leftJoin(donationCategories, eq(payments.categoryId, donationCategories.id))
      .where(and(eq(payments.userId, user.id), eq(payments.status, 'succeeded')))
      .orderBy(desc(payments.paidAt))
      .limit(50),
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
      .where(eq(pledges.userId, user.id))
      .orderBy(desc(pledges.createdAt))
      .limit(50),
    db.select().from(seats).where(eq(seats.holderUserId, user.id)).orderBy(desc(seats.year)),
    db.select().from(yahrzeits).where(eq(yahrzeits.userId, user.id)).orderBy(asc(yahrzeits.hebrewMonth), asc(yahrzeits.hebrewDay)),
    db.select().from(aliyos).where(eq(aliyos.recipientUserId, user.id)).orderBy(desc(aliyos.date)).limit(20),
    db.select().from(sponsorships).where(eq(sponsorships.sponsorUserId, user.id)).orderBy(desc(sponsorships.date)).limit(20),
    db
      .select({
        given: sql<number>`(select coalesce(sum(amount_cents),0) from payments where user_id = ${user.id} and status = 'succeeded')`,
      })
      .from(payments)
      .limit(1),
  ]);

  const given = Number(totals[0]?.given ?? 0);
  const outstanding = myPledges
    .filter((p) => p.pledge.status === 'open' || p.pledge.status === 'partial')
    .reduce((sum, p) => sum + Math.max(0, p.pledge.amountCents - Number(p.paid)), 0);

  const yahrzeitsWithDates = myYahrzeits
    .map((y) => {
      let iso = DateTime.fromJSDate(yahrzeitInYear(y.hebrewDay, y.hebrewMonth, thisHebrewYear)).toISODate()!;
      if (iso < today) iso = DateTime.fromJSDate(yahrzeitInYear(y.hebrewDay, y.hebrewMonth, thisHebrewYear + 1)).toISODate()!;
      return { ...y, iso };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  return (
    <>
      <PageHeader
        eyebrow={`Shalom, ${user.firstName}`}
        title="My account"
        subtitle="Your giving, your seats and your yahrzeits."
        actions={
          <>
            <Link href="/donate" className="btn-gold btn-sm">Make a donation</Link>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost btn-sm">Log out</button>
            </form>
          </>
        }
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Given to date" value={formatMoney(given)} hint={`${myPayments.length} gifts recorded`} tone="good" />
        <Stat label="Outstanding" value={formatMoney(outstanding)} tone={outstanding > 0 ? 'warn' : 'default'} hint={outstanding > 0 ? 'Pledges still to settle' : 'Nothing owing'} />
        <Stat label="Seats" value={String(mySeats.filter((s) => s.year >= 5786).length)} hint="Current and future years" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Giving history" titleHe="תרומות">
            {myPayments.length === 0 ? (
              <Empty>No gifts recorded against your account yet.</Empty>
            ) : (
              <table className="table-shul">
                <thead><tr><th>Date</th><th>For</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {myPayments.map(({ payment: p, category }) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-walnut-500">
                        {DateTime.fromSeconds(p.paidAt, { zone: tz }).toFormat('LLL d, yyyy')}
                      </td>
                      <td className="text-walnut-700">{category ?? 'General'}</td>
                      <td><Badge value={p.method} /></td>
                      <td className="text-right font-semibold tabular-nums text-walnut-800">{formatMoney(p.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {myPledges.length > 0 && (
            <Card title="Pledges" titleHe="התחייבויות">
              <table className="table-shul">
                <thead><tr><th>Made</th><th>For</th><th>Status</th><th className="text-right">Pledged</th><th className="text-right">Outstanding</th></tr></thead>
                <tbody>
                  {myPledges.map(({ pledge: p, category, paid }) => {
                    const owed = Math.max(0, p.amountCents - Number(paid));
                    return (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-walnut-500">
                          {DateTime.fromSeconds(p.createdAt, { zone: tz }).toFormat('LLL d, yyyy')}
                        </td>
                        <td>
                          <span className="block text-walnut-700">{category ?? 'General'}</span>
                          {p.occasion && <span className="block text-xs text-walnut-400">{p.occasion}</span>}
                        </td>
                        <td><Badge value={p.status} /></td>
                        <td className="text-right tabular-nums text-walnut-700">{formatMoney(p.amountCents)}</td>
                        <td className="text-right font-semibold tabular-nums text-amber-700">
                          {owed > 0 ? formatMoney(owed) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {outstanding > 0 && (
                <p className="mt-4 rounded-lg bg-gold-50 px-3 py-2.5 text-xs text-walnut-500">
                  To settle an outstanding pledge, <Link href="/donate" className="font-semibold text-gold-700 hover:underline">give online</Link> or speak to a gabbai.
                </p>
              )}
            </Card>
          )}

          {mySeats.length > 0 && (
            <Card title="My seats" titleHe="מקומות">
              <table className="table-shul">
                <thead><tr><th>Year</th><th>Section</th><th>Seat</th><th className="text-right">Price</th></tr></thead>
                <tbody>
                  {mySeats.map((s) => (
                    <tr key={s.id}>
                      <td className="tabular-nums text-walnut-700">{s.year}</td>
                      <td className="text-walnut-700">{s.section}</td>
                      <td className="font-semibold tabular-nums text-walnut-800">{s.row}{s.number}</td>
                      <td className="text-right tabular-nums text-walnut-700">{formatMoney(s.priceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {myAliyos.length > 0 && (
            <Card title="My aliyos" titleHe="עליות">
              <table className="table-shul">
                <thead><tr><th>Date</th><th>Parsha</th><th>Aliyah</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {myAliyos.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-walnut-500">{fmtDate(a.date, tz, 'LLL d, yyyy')}</td>
                      <td className="text-xs text-walnut-500">{a.parsha || '—'}</td>
                      <td className="text-walnut-700">{ALIYAH_LABELS[a.aliyah]?.en ?? a.aliyah}</td>
                      <td><Badge value={a.status} /></td>
                      <td className="text-right tabular-nums text-walnut-700">
                        {a.amountCents ? formatMoney(a.amountCents) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {mySponsorships.length > 0 && (
            <Card title="My sponsorships">
              <table className="table-shul">
                <thead><tr><th>Date</th><th>Kind</th><th>Occasion</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {mySponsorships.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap text-walnut-500">{fmtDate(s.date, tz, 'LLL d, yyyy')}</td>
                      <td className="capitalize text-walnut-700">{s.kind.replace(/_/g, ' ')}</td>
                      <td className="text-xs text-walnut-500">{s.occasion || '—'}</td>
                      <td><Badge value={s.status} /></td>
                      <td className="text-right tabular-nums text-walnut-700">{formatMoney(s.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div className="space-y-6">
          <Card title="My yahrzeits" titleHe="יארצייטן">
            {yahrzeitsWithDates.length === 0 ? (
              <Empty>None recorded.</Empty>
            ) : (
              <ul className="mb-4 space-y-3">
                {yahrzeitsWithDates.map((y) => (
                  <li key={y.id} className="border-b border-gold-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-walnut-800">{y.nifterName}</p>
                        {y.nifterNameHe && <p className="he font-hebrew text-xs text-gold-700">{y.nifterNameHe}</p>}
                        <p className="text-xs text-walnut-500">
                          {y.hebrewDay} {hebrewMonthLabel(y.hebrewMonth)}
                          {y.relationship && ` · ${y.relationship}`}
                        </p>
                        <p className="text-xs font-medium text-gold-700">
                          Next: {DateTime.fromISO(y.iso).toFormat('LLL d, yyyy')}
                        </p>
                      </div>
                      <form action={deleteYahrzeitAction}>
                        <input type="hidden" name="id" value={y.id} />
                        <input type="hidden" name="returnTo" value="/account" />
                        <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Remove</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details>
              <summary className="cursor-pointer text-sm font-semibold text-gold-700 hover:underline">Add a yahrzeit</summary>
              <form action={saveYahrzeitAction} className="mt-3 space-y-3">
                <input type="hidden" name="returnTo" value="/account" />
                <div>
                  <label className="label" htmlFor="y-name">Name of the niftar</label>
                  <input id="y-name" name="nifterName" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="y-nameHe">Hebrew name</label>
                  <input id="y-nameHe" name="nifterNameHe" dir="rtl" className="input font-hebrew" />
                </div>
                <div>
                  <label className="label" htmlFor="y-rel">Relationship</label>
                  <input id="y-rel" name="relationship" className="input" placeholder="Father" />
                </div>
                <fieldset>
                  <legend className="label">Hebrew date of petirah</legend>
                  <div className="grid grid-cols-3 gap-2">
                    <input name="hebrewDay" type="number" min={1} max={30} required placeholder="Day" className="input tabular-nums" aria-label="Hebrew day" />
                    <select name="hebrewMonth" required defaultValue="" className="select" aria-label="Hebrew month">
                      <option value="">Month</option>
                      {HEBREW_MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <input name="hebrewYear" type="number" required defaultValue={thisHebrewYear} placeholder="Year" className="input tabular-nums" aria-label="Hebrew year" />
                  </div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="showOnDisplay" defaultChecked className="accent-gold-600" /> Show on the shul board
                </label>
                <button type="submit" className="btn-primary w-full">Save yahrzeit</button>
              </form>
            </details>
          </Card>

          <Card title="My details">
            <form action={updateProfileAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="p-first">First name</label>
                  <input id="p-first" name="firstName" defaultValue={user.firstName} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="p-last">Last name</label>
                  <input id="p-last" name="lastName" defaultValue={user.lastName} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="p-heb">Hebrew name</label>
                <input id="p-heb" name="hebrewName" dir="rtl" defaultValue={user.hebrewName ?? ''} className="input font-hebrew" />
              </div>
              <div>
                <label className="label" htmlFor="p-phone">Phone</label>
                <input id="p-phone" name="phone" type="tel" defaultValue={user.phone ?? ''} className="input" />
              </div>
              <p className="text-xs text-walnut-400">Signed in as {user.email}</p>
              <button type="submit" className="btn-ghost w-full">Save details</button>
            </form>
          </Card>

          <Card title="Change password">
            <form action={changePasswordAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="pw-cur">Current password</label>
                <input id="pw-cur" name="currentPassword" type="password" required autoComplete="current-password" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="pw-new">New password</label>
                <input id="pw-new" name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="pw-conf">Confirm new password</label>
                <input id="pw-conf" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className="input" />
              </div>
              <button type="submit" className="btn-ghost w-full">Change password</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
