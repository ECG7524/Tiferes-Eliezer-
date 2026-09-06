import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { computeZmanim, todayISO, addDaysISO, fmtTime, fmtDate } from '@/lib/zmanim';
import { PageHeader, Card } from '@/components/ui';

export const metadata = { title: 'Zmanim' };
export const dynamic = 'force-dynamic';

/** Grouped the way a printed luach reads: morning, midday, then evening. */
const GROUPS: { heading: string; headingHe: string; ids: string[] }[] = [
  {
    heading: 'Morning',
    headingHe: 'זמני הבוקר',
    ids: ['alos', 'misheyakir', 'sunrise', 'sofZmanShmaMGA', 'sofZmanShmaGRA', 'sofZmanTfilaMGA', 'sofZmanTfilaGRA'],
  },
  { heading: 'Midday', headingHe: 'חצות ומנחה', ids: ['chatzos', 'minchaGedola', 'minchaKetana', 'plag'] },
  { heading: 'Evening', headingHe: 'זמני הערב', ids: ['candleLighting', 'sunset', 'tzais', 'tzais72', 'chatzosHalayla'] },
];

export default async function ZmanimPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);

  const iso = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;
  const day = computeZmanim(iso, settings);
  const { info } = day;

  const byId = new Map(day.zmanim.map((z) => [z.id, z]));
  const durations = day.zmanim.filter((z) => z.isDuration);

  return (
    <>
      <PageHeader
        eyebrow={`${settings.city}, ${settings.state}`}
        title="Zmanim"
        titleHe="זמני היום"
        subtitle={
          <>
            Calculated for {settings.addressLine}, {settings.city} — latitude {settings.latitude.toFixed(4)},
            longitude {settings.longitude.toFixed(4)}, elevation {Math.round(settings.elevation)} m.
          </>
        }
        actions={
          <>
            <Link href={`/zmanim?date=${addDaysISO(iso, -1, tz)}`} className="btn-ghost btn-sm">← Previous</Link>
            {iso !== today && <Link href="/zmanim" className="btn-ghost btn-sm">Today</Link>}
            <Link href={`/zmanim?date=${addDaysISO(iso, 1, tz)}`} className="btn-ghost btn-sm">Next →</Link>
          </>
        }
      />

      {/* Date banner */}
      <div className="card card-pad mb-6 text-center">
        <p className="font-display text-2xl font-semibold text-walnut-800">{fmtDate(iso, tz)}</p>
        <p className="he mt-1 font-hebrew text-xl text-gold-700">{info.hebrewDateHe}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          {info.parsha && <span className="badge bg-gold-100 text-gold-900">Parashas {info.parsha}</span>}
          {info.holidays.map((h) => (
            <span key={h.en} className="badge bg-gold-200 text-gold-900">{h.en}</span>
          ))}
          {info.isRoshChodesh && <span className="badge bg-gold-100 text-gold-900">Rosh Chodesh</span>}
          {info.omer && <span className="badge bg-walnut-100 text-walnut-700">Omer day {info.omer}</span>}
          {info.dafYomi && <span className="badge bg-walnut-100 text-walnut-700">Daf Yomi · {info.dafYomi}</span>}
        </div>

        <form action="/zmanim" className="mt-5 flex flex-wrap items-end justify-center gap-2 no-print">
          <div>
            <label className="label text-left" htmlFor="date">Jump to a date</label>
            <input id="date" name="date" type="date" defaultValue={iso} className="input" />
          </div>
          <button type="submit" className="btn-ghost">Show</button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.heading} title={g.heading} titleHe={g.headingHe}>
            <dl className="space-y-0">
              {g.ids.map((id) => {
                const z = byId.get(id as never);
                if (!z) return null;
                return (
                  <div key={id} className="border-b border-gold-100 py-3 last:border-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="min-w-0">
                        <span className="block text-sm font-medium text-walnut-700">{z.label}</span>
                        <span className="he block font-hebrew text-xs text-gold-700">{z.labelHe}</span>
                      </dt>
                      <dd className="shrink-0 font-display text-xl font-semibold tabular-nums text-walnut-800">
                        {fmtTime(z.at, tz)}
                      </dd>
                    </div>
                    {z.note && <p className="mt-1 text-[11px] text-walnut-400">{z.note}</p>}
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Proportional hours" titleHe="שעה זמנית">
          <dl className="space-y-0">
            {durations.map((z) => (
              <div key={z.id} className="flex items-baseline justify-between gap-3 border-b border-gold-100 py-3 last:border-0">
                <dt>
                  <span className="block text-sm font-medium text-walnut-700">{z.label}</span>
                  <span className="he block font-hebrew text-xs text-gold-700">{z.labelHe}</span>
                </dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-walnut-800">
                  {z.minutes != null ? `${z.minutes} min` : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="A note on these times">
          <div className="space-y-3 text-sm leading-relaxed text-walnut-600">
            <p>
              These zmanim are calculated for the shul&apos;s own coordinates using the standard
              astronomical method (NOAA), the same engine behind the widely used KosherJava luach.
            </p>
            <p>
              Where opinions differ the shul&apos;s chosen view is noted beneath the time. Candle
              lighting is set at {settings.candleLightingMinutes} minutes before shkia.
            </p>
            <p className="text-xs text-walnut-400">
              For any question with practical halachic consequence, ask the Rav.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
