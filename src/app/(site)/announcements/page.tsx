import Link from 'next/link';
import { gte, asc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { events } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getLiveAnnouncements } from '@/lib/schedule';
import { PageHeader, Card, Badge, Empty } from '@/components/ui';

export const metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const tz = settings.timezone;
  const now = Math.floor(Date.now() / 1000);

  const [news, upcoming] = await Promise.all([
    getLiveAnnouncements({ audience: user ? 'members' : 'public', limit: 50 }),
    db.select().from(events).where(gte(events.startAt, now)).orderBy(asc(events.startAt)).limit(10),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="From the shul office"
        title="Announcements"
        titleHe="הודעות"
        subtitle={user ? undefined : 'Members see additional notices once they log in.'}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {news.length === 0 ? (
            <Empty>Nothing posted right now.</Empty>
          ) : (
            <div className="space-y-4">
              {news.map((a) => (
                <article
                  key={a.id}
                  className={`card card-pad ${
                    a.priority === 'urgent' ? 'border-rose-300 bg-rose-50/50'
                      : a.priority === 'high' ? 'border-amber-300 bg-amber-50/40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <Badge value="high" label="Pinned" />}
                    {a.priority !== 'normal' && <Badge value={a.priority} />}
                    {a.audience === 'members' && <Badge value="member" label="Members only" />}
                  </div>
                  <h2 className="mt-2 text-xl">{a.title}</h2>
                  {a.body && (
                    <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-walnut-600">{a.body}</div>
                  )}
                  <p className="mt-3 text-xs text-walnut-400">
                    {DateTime.fromSeconds(a.publishAt, { zone: tz }).toFormat('cccc, LLLL d, yyyy')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Upcoming events">
            {upcoming.length === 0 ? (
              <Empty>Nothing on the calendar.</Empty>
            ) : (
              <ul className="space-y-4">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <p className="text-sm font-semibold text-walnut-800">{e.title}</p>
                    <p className="text-xs text-gold-700">
                      {DateTime.fromSeconds(e.startAt, { zone: tz }).toFormat('ccc, LLL d · h:mm a')}
                    </p>
                    {e.location && <p className="text-xs text-walnut-400">{e.location}</p>}
                    {e.description && <p className="mt-1 text-xs text-walnut-500">{e.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!user && (
            <Card title="Members">
              <p className="text-sm text-walnut-600">
                Some notices are for members only.{' '}
                <Link href="/login" className="font-semibold text-gold-700 hover:underline">Log in</Link> or{' '}
                <Link href="/register" className="font-semibold text-gold-700 hover:underline">sign up</Link>.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
