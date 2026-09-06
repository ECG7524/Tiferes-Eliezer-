import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { minyanim, shiurim } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getDaySchedule } from '@/lib/schedule';
import { todayISO, addDaysISO, fmtTime, fmtDate, DAY_TYPE_LABELS, ANCHOR_LABELS } from '@/lib/zmanim';
import { PageHeader, Card, Empty } from '@/components/ui';

export const metadata = { title: 'Davening & Shiurim' };
export const dynamic = 'force-dynamic';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;

  // The next week at a glance, plus the standing rules underneath.
  const week = await Promise.all(
    Array.from({ length: 7 }, (_, i) => addDaysISO(iso, i, tz)).map((d) => getDaySchedule(d, settings)),
  );

  const [standingMinyanim, standingShiurim] = await Promise.all([
    db.select().from(minyanim).where(eq(minyanim.active, true)).orderBy(asc(minyanim.sortOrder), asc(minyanim.name)),
    db.select().from(shiurim).where(eq(shiurim.active, true)).orderBy(asc(shiurim.sortOrder), asc(shiurim.title)),
  ]);

  // Group the standing minyan rules by which days they run on.
  const byDayType = new Map<string, typeof standingMinyanim>();
  for (const m of standingMinyanim) {
    const list = byDayType.get(m.dayType) ?? [];
    list.push(m);
    byDayType.set(m.dayType, list);
  }

  return (
    <>
      <PageHeader
        eyebrow="The shul week"
        title="Davening &amp; Shiurim"
        titleHe="זמני התפילות והשיעורים"
        subtitle="Times that follow a zman — Mincha before shkia, Maariv after tzais — move with the calendar automatically, so what you see here is always the real time for that day."
        actions={
          <>
            <Link href={`/schedule?date=${addDaysISO(iso, -7, tz)}`} className="btn-ghost btn-sm">← Previous week</Link>
            {iso !== today && <Link href="/schedule" className="btn-ghost btn-sm">This week</Link>}
            <Link href={`/schedule?date=${addDaysISO(iso, 7, tz)}`} className="btn-ghost btn-sm">Next week →</Link>
          </>
        }
      />

      {/* ---------- Week grid ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {week.map((d) => {
          const isToday = d.iso === today;
          const { info } = d.day;
          return (
            <section
              key={d.iso}
              className={`card overflow-hidden ${isToday ? 'ring-2 ring-gold-500' : ''}`}
            >
              <header className={`px-4 py-3 ${isToday ? 'bg-gold-100' : 'bg-gold-50/60'} border-b border-gold-200`}>
                <p className="text-sm font-semibold text-walnut-800">
                  {DOW[info.dayOfWeek]}
                  {isToday && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-700">Today</span>}
                </p>
                <p className="text-xs text-walnut-500">{fmtDate(d.iso, tz, 'LLL d')}</p>
                <p className="he mt-0.5 font-hebrew text-xs text-gold-700">{info.hebrewDateHe}</p>
                {info.holidays.length > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-gold-800">
                    {info.holidays.map((h) => h.en).join(' · ')}
                  </p>
                )}
              </header>

              <div className="px-4 py-3">
                {d.minyanim.length === 0 ? (
                  <p className="py-2 text-xs text-walnut-400">No minyanim listed.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.minyanim.map((m) => (
                      <li key={m.id}>
                        <span className="block text-xs leading-tight text-walnut-600">{m.name}</span>
                        <span className="block font-semibold tabular-nums text-walnut-800">
                          {fmtTime(m.at, tz)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {d.shiurim.length > 0 && (
                  <>
                    <hr className="my-3 border-gold-100" />
                    <ul className="space-y-2">
                      {d.shiurim.map((s) => (
                        <li key={s.id} className="text-xs">
                          <span className="block leading-tight text-gold-800">{s.title}</span>
                          <span className="block tabular-nums text-walnut-500">{fmtTime(s.at, tz)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Candle lighting is the one zman that belongs on a weekly view. */}
                {d.day.byId.candleLighting && (
                  <p className="mt-3 rounded bg-gold-50 px-2 py-1.5 text-center text-xs text-gold-900">
                    Candles {fmtTime(d.day.byId.candleLighting, tz)}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ---------- Standing schedule ---------- */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card title="Standing davening times" titleHe="סדר התפילות">
          {standingMinyanim.length === 0 ? (
            <Empty>No minyanim have been entered yet.</Empty>
          ) : (
            <div className="space-y-5">
              {[...byDayType.entries()].map(([dayType, list]) => (
                <div key={dayType}>
                  <h3 className="eyebrow mb-2">{DAY_TYPE_LABELS[dayType] ?? dayType}</h3>
                  <table className="table-shul">
                    <tbody>
                      {list.map((m) => (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap font-medium text-walnut-700">
                            {m.name}
                            {m.nameHe && <span className="he ml-2 font-hebrew text-xs text-gold-700">{m.nameHe}</span>}
                          </td>
                          <td className="text-xs text-walnut-400">{m.location}</td>
                          <td className="text-right font-semibold tabular-nums text-walnut-800">
                            {m.timeType === 'fixed'
                              ? DateTime.fromFormat(m.fixedTime ?? '', 'HH:mm').toFormat('h:mm a')
                              : describeRelative(m.relativeTo, m.offsetMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Shiurim" titleHe="שיעורים">
          {standingShiurim.length === 0 ? (
            <Empty>No shiurim have been entered yet.</Empty>
          ) : (
            <ul className="space-y-4">
              {standingShiurim.map((s) => (
                <li key={s.id} className="border-b border-gold-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-walnut-800">
                      {s.title}
                      {s.titleHe && <span className="he ml-2 font-hebrew text-xs text-gold-700">{s.titleHe}</span>}
                    </h3>
                    <span className="text-sm font-semibold tabular-nums text-gold-700">
                      {s.timeType === 'fixed'
                        ? DateTime.fromFormat(s.startTime ?? '', 'HH:mm').toFormat('h:mm a')
                        : describeRelative(s.relativeTo, s.offsetMinutes)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-walnut-500">
                    {s.recurrence === 'daily'
                      ? 'Every day'
                      : s.recurrence === 'weekly' && s.dayOfWeek != null
                        ? DOW[s.dayOfWeek]
                        : s.specificDate
                          ? fmtDate(s.specificDate, tz, 'cccc, LLL d')
                          : 'By arrangement'}
                    {s.maggidShiur && ` · ${s.maggidShiur}`}
                    {s.location && ` · ${s.location}`}
                  </p>
                  {s.description && <p className="mt-1.5 text-xs leading-relaxed text-walnut-500">{s.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function describeRelative(anchor: string | null, offset: number): string {
  const label = ANCHOR_LABELS[anchor ?? 'sunset'] ?? anchor ?? '';
  if (offset === 0) return label;
  return `${Math.abs(offset)} min ${offset < 0 ? 'before' : 'after'} ${label}`;
}
