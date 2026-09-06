import { desc, eq, asc, sql, gte } from 'drizzle-orm';
import { db } from '@/db';
import { aliyos, users } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { computeZmanim, todayISO, fmtDate, addDaysISO } from '@/lib/zmanim';
import { formatMoney } from '@/lib/money';
import { saveAliyahAction, deleteAliyahAction } from '@/actions/aliyos';
import { ALIYAH_LABELS } from '@/lib/aliyos';
import { PageHeader, Card, Stat, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminAliyosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; date?: string; edit?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);

  // Default to the most recent Shabbos, since that is when aliyos are given out.
  let defaultDate = today;
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(today, -i, tz);
    if (computeZmanim(iso, settings).info.isShabbos) { defaultDate = iso; break; }
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : defaultDate;
  const { info } = computeZmanim(date, settings);

  const [rows, dayRows, members, totals] = await Promise.all([
    db.select().from(aliyos).orderBy(desc(aliyos.date), asc(aliyos.id)).limit(200),
    db.select().from(aliyos).where(eq(aliyos.date, date)).orderBy(asc(aliyos.id)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.status, 'active')).orderBy(asc(users.lastName)),
    db
      .select({
        total: sql<number>`coalesce(sum(${aliyos.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(aliyos)
      .where(gte(aliyos.date, addDaysISO(today, -365, tz))),
  ]);

  const editing = sp.edit ? rows.find((r) => r.id === Number(sp.edit)) : undefined;
  const dayTotal = dayRows.reduce((sum, r) => sum + r.amountCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Gabbai's book"
        title="Aliyos"
        titleHe="עליות"
        subtitle="Who was called up, and what they undertook. Anything with an amount can be booked straight into the ledger as a pledge."
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pledged this past year" value={formatMoney(Number(totals[0]?.total ?? 0))} hint={`${Number(totals[0]?.count ?? 0)} aliyos recorded`} />
        <Stat label="On this date" value={formatMoney(dayTotal)} hint={`${dayRows.length} recorded`} />
        <Stat label="Parsha" value={info.parsha ?? '—'} hint={info.hebrewDate} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card
            title={`Aliyos — ${fmtDate(date, tz, 'cccc, LLLL d')}`}
            titleHe={info.parshaHe ?? undefined}
            action={
              <form action="/admin/aliyos" className="flex items-center gap-2">
                <input name="date" type="date" defaultValue={date} className="input py-1 text-xs" />
                <button type="submit" className="btn-ghost btn-sm">Go</button>
              </form>
            }
          >
            {dayRows.length === 0 ? (
              <Empty>Nothing recorded for this date yet.</Empty>
            ) : (
              <table className="table-shul">
                <thead>
                  <tr><th>Aliyah</th><th>Recipient</th><th>Status</th><th className="text-right">Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {dayRows.map((r) => {
                    const label = ALIYAH_LABELS[r.aliyah] ?? { en: r.aliyah, he: '' };
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="font-medium text-walnut-800">{label.en}</span>
                          {label.he && <span className="he ml-2 font-hebrew text-xs text-gold-700">{label.he}</span>}
                        </td>
                        <td className="text-walnut-700">{r.recipientName}</td>
                        <td><Badge value={r.status} /></td>
                        <td className="text-right font-semibold tabular-nums text-walnut-800">
                          {r.amountCents ? formatMoney(r.amountCents) : '—'}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <a href={`/admin/aliyos?date=${date}&edit=${r.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                          <form action={deleteAliyahAction} className="mt-1">
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Recent history">
            {rows.length === 0 ? (
              <Empty>No aliyos recorded yet.</Empty>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="table-shul">
                  <thead className="sticky top-0 bg-white">
                    <tr><th>Date</th><th>Parsha</th><th>Aliyah</th><th>Recipient</th><th className="text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-walnut-500">{fmtDate(r.date, tz, 'LLL d, yy')}</td>
                        <td className="text-xs text-walnut-500">{r.parsha || '—'}</td>
                        <td className="text-walnut-700">{ALIYAH_LABELS[r.aliyah]?.en ?? r.aliyah}</td>
                        <td className="text-walnut-800">{r.recipientName}</td>
                        <td className="text-right tabular-nums text-walnut-700">
                          {r.amountCents ? formatMoney(r.amountCents) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title={editing ? 'Edit aliyah' : 'Record an aliyah'}>
          <form action={saveAliyahAction} className="space-y-3" key={editing?.id ?? `new-${date}`}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="label" htmlFor="al-date">Date</label>
              <input id="al-date" name="date" type="date" required defaultValue={editing?.date ?? date} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="al-aliyah">Aliyah</label>
              <select id="al-aliyah" name="aliyah" defaultValue={editing?.aliyah ?? 'kohen'} className="select">
                {Object.entries(ALIYAH_LABELS).map(([key, v]) => (
                  <option key={key} value={key}>{v.en}{v.he ? ` — ${v.he}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="al-member">Member</label>
              <select id="al-member" name="recipientUserId" defaultValue={editing?.recipientUserId ?? ''} className="select">
                <option value="">— Not a registered member —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="al-name">Name</label>
              <input id="al-name" name="recipientName" defaultValue={editing?.recipientName ?? ''} className="input" placeholder="Filled in from the member if left blank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="al-amt">Amount</label>
                <input id="al-amt" name="amountCents" inputMode="decimal" defaultValue={editing ? editing.amountCents / 100 : settings.defaultAliyahCents / 100} className="input tabular-nums" />
              </div>
              <div>
                <label className="label" htmlFor="al-status">Status</label>
                <select id="al-status" name="status" defaultValue={editing?.status ?? 'pledged'} className="select">
                  <option value="pledged">Pledged</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="al-occ">Occasion</label>
              <input id="al-occ" name="occasionLabel" defaultValue={editing?.occasionLabel ?? ''} className="input" placeholder="Aufruf · Yahrzeit · Bar mitzvah" />
            </div>
            {!editing && (
              <label className="flex items-start gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="createPledge" defaultChecked className="mt-0.5 accent-gold-600" />
                <span>Book the amount as a pledge in the ledger</span>
              </label>
            )}
            <button type="submit" className="btn-primary w-full">{editing ? 'Save' : 'Record aliyah'}</button>
            {editing && <a href={`/admin/aliyos?date=${date}`} className="btn-ghost w-full">Cancel</a>}
          </form>
        </Card>
      </div>
    </>
  );
}
