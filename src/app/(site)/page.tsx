import Link from 'next/link';
import { DateTime } from 'luxon';
import { eq, and, gte, asc } from 'drizzle-orm';
import { db } from '@/db';
import { sponsorships } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { getDaySchedule, getUpNext, getLiveAnnouncements } from '@/lib/schedule';
import { todayISO, fmtTime, fmtDate } from '@/lib/zmanim';
import { Crest } from '@/components/Crest';
import { Card, Badge, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** The handful of zmanim people actually check on a phone before shul. */
const HEADLINE = ['sunrise', 'sofZmanShmaGRA', 'chatzos', 'plag', 'candleLighting', 'sunset', 'tzais'];

export default async function HomePage() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const iso = todayISO(tz);

  const [user, schedule, upNext, news, upcoming] = await Promise.all([
    getCurrentUser(),
    getDaySchedule(iso, settings),
    getUpNext(settings, 4),
    getLiveAnnouncements({ audience: 'public', limit: 4 }),
    db
      .select()
      .from(sponsorships)
      .where(and(gte(sponsorships.date, iso), eq(sponsorships.status, 'open')))
      .orderBy(asc(sponsorships.date))
      .limit(3),
  ]);

  const { info } = schedule.day;
  const headline = schedule.day.zmanim.filter((z) => HEADLINE.includes(z.id) && z.at != null);

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-gold-200 bg-gradient-to-b from-ivory-50 to-ivory-200 px-6 py-10 text-center shadow-crest sm:py-14">
        <div className="flex justify-center">
          <Crest variant="full" size="xl" nameHe={settings.nameHe} nameEn={settings.nameEn} />
        </div>
        {/* The full crest already carries the dedication and nasi lines, so they
            are not repeated here. */}
        <hr className="rule-gold mx-auto my-6 max-w-sm" />

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
          <span className="font-display text-lg font-semibold text-walnut-800">{fmtDate(iso, tz)}</span>
          <span className="text-gold-500" aria-hidden>·</span>
          <span className="he font-hebrew text-lg text-gold-700">{info.hebrewDateHe}</span>
          {info.parsha && (
            <>
              <span className="text-gold-500" aria-hidden>·</span>
              <span className="he font-hebrew text-lg text-gold-700">{info.parshaHe}</span>
            </>
          )}
        </div>

        {info.holidays.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {info.holidays.map((h) => (
              <span key={h.en} className="badge bg-gold-200 text-gold-900">{h.en}</span>
            ))}
          </div>
        )}
        {info.omer && (
          <p className="mt-3 text-sm text-walnut-500">Today is day {info.omer} of the Omer</p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/donate" className="btn-gold">Make a donation</Link>
          <Link href="/zmanim" className="btn-ghost">Full zmanim</Link>
          <Link href="/schedule" className="btn-ghost">Davening &amp; shiurim</Link>
        </div>
      </section>

      {/* ---------------- Main grid ---------------- */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card title="Today's zmanim" titleHe="זמני היום" action={<Link href="/zmanim" className="text-xs font-semibold text-gold-700 hover:underline">All zmanim →</Link>}>
          <dl className="space-y-0">
            {headline.map((z) => (
              <div key={z.id} className="flex items-baseline justify-between gap-3 border-b border-gold-100 py-2.5 last:border-0">
                <dt className="min-w-0">
                  <span className="block truncate text-sm text-walnut-700">{z.label}</span>
                  <span className="he block font-hebrew text-xs text-gold-700">{z.labelHe}</span>
                </dt>
                <dd className="shrink-0 font-display text-lg font-semibold tabular-nums text-walnut-800">
                  {fmtTime(z.at, tz)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Coming up" titleHe="תפילות">
          {upNext.length === 0 ? (
            <Empty>No davening times have been entered yet.</Empty>
          ) : (
            <ul className="space-y-0">
              {upNext.map((m, i) => {
                const when = DateTime.fromMillis(m.at!, { zone: tz });
                const isToday = m.iso === iso;
                return (
                  <li key={`${m.id}-${m.iso}`} className="flex items-baseline justify-between gap-3 border-b border-gold-100 py-2.5 last:border-0">
                    <div className="min-w-0">
                      <span className={`block truncate text-sm ${i === 0 ? 'font-semibold text-walnut-800' : 'text-walnut-700'}`}>
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-walnut-400">
                        {isToday ? m.location : `${when.toFormat('ccc')} · ${m.location}`}
                      </span>
                    </div>
                    <span className={`shrink-0 font-display tabular-nums ${i === 0 ? 'text-xl font-semibold text-gold-700' : 'text-lg text-walnut-700'}`}>
                      {when.toFormat('h:mm a')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/schedule" className="mt-4 block text-xs font-semibold text-gold-700 hover:underline">
            Full schedule →
          </Link>
        </Card>

        <div className="space-y-6">
          <Card title="Announcements" titleHe="הודעות">
            {news.length === 0 ? (
              <Empty>Nothing new right now.</Empty>
            ) : (
              <ul className="space-y-3.5">
                {news.map((a) => (
                  <li key={a.id}>
                    <div className="flex items-start gap-2">
                      {a.priority !== 'normal' && <Badge value={a.priority} />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-walnut-800">{a.title}</p>
                        {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-walnut-500">{a.body}</p>}
                        {a.imageFile && (
                          <Link href="/announcements" className="mt-1 inline-block text-xs font-semibold text-gold-700 hover:underline">
                            View the flyer →
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!user && (
              <p className="mt-4 border-t border-gold-100 pt-3 text-xs text-walnut-400">
                <Link href="/login" className="font-semibold text-gold-700 hover:underline">Log in</Link>{' '}
                to see members-only notices.
              </p>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card title="Open for sponsorship">
              <ul className="space-y-2.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium capitalize text-walnut-700">
                        {s.kind.replace(/_/g, ' ')}
                      </span>
                      <span className="block truncate text-xs text-walnut-400">
                        {s.label || fmtDate(s.date, tz, 'LLL d')}
                      </span>
                    </span>
                    <Link href={`/sponsor?date=${s.date}`} className="btn-ghost btn-sm shrink-0">Sponsor</Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* ---------------- Today's shiurim ---------------- */}
      {schedule.shiurim.length > 0 && (
        <div className="mt-6">
          <Card title="Shiurim today" titleHe="שיעורים">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schedule.shiurim.map((s) => (
                <li key={s.id} className="rounded-lg border border-gold-200 bg-gold-50/40 p-3">
                  <p className="text-sm font-semibold text-walnut-800">{s.title}</p>
                  {s.maggidShiur && <p className="text-xs text-walnut-500">{s.maggidShiur}</p>}
                  <p className="mt-1.5 font-display text-base font-semibold tabular-nums text-gold-700">
                    {fmtTime(s.at, tz)}
                    {s.location && <span className="ml-2 font-body text-xs font-normal text-walnut-400">{s.location}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
