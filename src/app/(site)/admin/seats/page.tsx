import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { seats, users } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { generateSeatsAction, assignSeatAction, releaseSeatAction, deleteSeatAction, rolloverSeatsAction } from '@/actions/seats';
import { PageHeader, Card, Stat, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminSeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; year?: string; assign?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);

  const years = await db
    .select({ year: seats.year, count: sql<number>`count(*)` })
    .from(seats)
    .groupBy(seats.year)
    .orderBy(asc(seats.year));

  const year = Number(sp.year) || years.at(-1)?.year || 5786;

  const [rows, members] = await Promise.all([
    db.select().from(seats).where(eq(seats.year, year)).orderBy(asc(seats.section), asc(seats.row), asc(seats.number)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.status, 'active')).orderBy(asc(users.lastName)),
  ]);

  const assigning = sp.assign ? rows.find((r) => r.id === Number(sp.assign)) : undefined;

  const assigned = rows.filter((r) => r.status === 'assigned').length;
  const revenue = rows.filter((r) => r.status === 'assigned').reduce((sum, r) => sum + r.priceCents, 0);

  // Grouped section → row → seats, which is how a seating chart actually reads.
  const bySection = new Map<string, Map<string, typeof rows>>();
  for (const s of rows) {
    const sec = bySection.get(s.section) ?? new Map();
    const row = sec.get(s.row) ?? [];
    row.push(s);
    sec.set(s.row, row);
    bySection.set(s.section, sec);
  }

  return (
    <>
      <PageHeader
        eyebrow={`Year ${year}`}
        title="Seats"
        subtitle="Who sits where, what they were charged, and what is still free. Assigning a seat can book the money owed as a pledge in the same breath."
        actions={
          <form action="/admin/seats" className="flex items-end gap-2">
            <select name="year" defaultValue={year} className="select py-1.5 text-xs">
              {years.map((y) => <option key={y.year} value={y.year}>{y.year} ({Number(y.count)} seats)</option>)}
              {!years.some((y) => y.year === year) && <option value={year}>{year}</option>}
            </select>
            <button type="submit" className="btn-ghost btn-sm">Show</button>
          </form>
        }
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Seats in the chart" value={String(rows.length)} />
        <Stat label="Assigned" value={`${assigned} / ${rows.length}`} tone={assigned === rows.length && rows.length > 0 ? 'good' : 'default'} />
        <Stat label="Committed value" value={formatMoney(revenue)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {rows.length === 0 ? (
            <Empty>No seats laid out for {year} yet — set up the chart alongside.</Empty>
          ) : (
            [...bySection.entries()].map(([section, sectionRows]) => (
              <Card key={section} title={section}>
                <div className="space-y-4">
                  {[...sectionRows.entries()].map(([row, list]) => (
                    <div key={row}>
                      <h3 className="eyebrow mb-2">Row {row}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((s) => {
                          const taken = s.status === 'assigned';
                          return (
                            <a
                              key={s.id}
                              href={`/admin/seats?year=${year}&assign=${s.id}`}
                              title={taken ? `${s.holderName} · ${formatMoney(s.priceCents)}` : `Free · ${formatMoney(s.priceCents)}`}
                              className={`flex h-14 w-20 flex-col items-center justify-center rounded-lg border px-1 text-center transition-colors ${
                                taken
                                  ? 'border-walnut-400 bg-walnut-100 hover:bg-walnut-200'
                                  : 'border-dashed border-gold-400 bg-gold-50 hover:bg-gold-100'
                              } ${assigning?.id === s.id ? 'ring-2 ring-gold-500' : ''}`}
                            >
                              <span className="text-xs font-semibold tabular-nums text-walnut-800">{s.row}{s.number}</span>
                              <span className="mt-0.5 w-full truncate text-[10px] text-walnut-500">
                                {taken ? s.holderName : 'free'}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-6">
          {assigning && (
            <Card title={`Seat ${assigning.section} ${assigning.row}${assigning.number}`}>
              <div className="mb-3 flex items-center gap-2">
                <Badge value={assigning.status} />
                {assigning.pledgeId && <span className="text-xs text-walnut-400">Pledge #{assigning.pledgeId}</span>}
              </div>

              <form action={assignSeatAction} className="space-y-3">
                <input type="hidden" name="id" value={assigning.id} />
                <div>
                  <label className="label" htmlFor="a-member">Member</label>
                  <select id="a-member" name="holderUserId" defaultValue={assigning.holderUserId ?? ''} className="select">
                    <option value="">— Not a registered member —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="a-name">Name on the seat</label>
                  <input id="a-name" name="holderName" defaultValue={assigning.holderName ?? ''} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="a-price">Price</label>
                  <input id="a-price" name="priceCents" inputMode="decimal" defaultValue={assigning.priceCents / 100} className="input tabular-nums" />
                </div>
                <label className="flex items-start gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="createPledge" defaultChecked className="mt-0.5 accent-gold-600" />
                  <span>Book this as a pledge in the ledger</span>
                </label>
                <button type="submit" className="btn-primary w-full">Assign seat</button>
              </form>

              <div className="mt-3 flex gap-2">
                {assigning.status === 'assigned' && (
                  <form action={releaseSeatAction} className="flex-1">
                    <input type="hidden" name="id" value={assigning.id} />
                    <button type="submit" className="btn-ghost w-full btn-sm">Release</button>
                  </form>
                )}
                <form action={deleteSeatAction} className="flex-1">
                  <input type="hidden" name="id" value={assigning.id} />
                  <button type="submit" className="btn-ghost w-full btn-sm text-rose-600">Delete seat</button>
                </form>
              </div>
              <a href={`/admin/seats?year=${year}`} className="mt-2 block text-center text-xs text-walnut-400 hover:underline">Close</a>
            </Card>
          )}

          <Card title="Lay out seats">
            <form action={generateSeatsAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="g-section">Section</label>
                <input id="g-section" name="section" defaultValue="Main Shul" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="g-rows">Rows</label>
                <input id="g-rows" name="rows" required defaultValue="A, B, C, D" className="input" />
                <p className="mt-1 text-xs text-walnut-400">Comma separated.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="g-per">Seats per row</label>
                  <input id="g-per" name="perRow" type="number" min={1} max={100} defaultValue={10} className="input tabular-nums" />
                </div>
                <div>
                  <label className="label" htmlFor="g-year">Year</label>
                  <input id="g-year" name="year" type="number" defaultValue={year} className="input tabular-nums" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="g-price">Price each</label>
                <input id="g-price" name="priceCents" inputMode="decimal" defaultValue={settings.defaultSeatCents / 100} className="input tabular-nums" />
              </div>
              <button type="submit" className="btn-ghost w-full">Create seats</button>
            </form>
          </Card>

          <Card title="Carry over to a new year">
            <form action={rolloverSeatsAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="r-from">From</label>
                  <input id="r-from" name="fromYear" type="number" defaultValue={year} className="input tabular-nums" />
                </div>
                <div>
                  <label className="label" htmlFor="r-to">To</label>
                  <input id="r-to" name="toYear" type="number" defaultValue={year + 1} className="input tabular-nums" />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="keepHolders" defaultChecked className="mt-0.5 accent-gold-600" />
                <span>Keep the same people in the same seats</span>
              </label>
              <button type="submit" className="btn-ghost w-full">Carry over</button>
              <p className="text-xs text-walnut-400">Payment starts fresh — no pledges are carried across.</p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
