import Link from 'next/link';
import { gte, asc } from 'drizzle-orm';
import { db } from '@/db';
import { sponsorships } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { todayISO, fmtDate } from '@/lib/zmanim';
import { formatMoney } from '@/lib/money';
import { requestSponsorshipAction } from '@/actions/sponsorships';
import { PageHeader, Card, Badge, Empty, Flash } from '@/components/ui';

export const metadata = { title: 'Sponsor a Kiddush' };
export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, { en: string; he: string }> = {
  kiddush: { en: 'Kiddush', he: 'קידוש' },
  shalosh_seudos: { en: 'Shalosh Seudos', he: 'שלוש סעודות' },
  seudas_yom_tov: { en: 'Seudas Yom Tov', he: 'סעודת יום טוב' },
  melava_malka: { en: 'Melava Malka', he: 'מלווה מלכה' },
};

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; date?: string }>;
}) {
  const [sp, settings, user] = await Promise.all([searchParams, getSettings(), getCurrentUser()]);
  const tz = settings.timezone;
  const today = todayISO(tz);

  const slots = await db
    .select()
    .from(sponsorships)
    .where(gte(sponsorships.date, today))
    .orderBy(asc(sponsorships.date), asc(sponsorships.kind))
    .limit(60);

  // Group by date so a Shabbos shows its kiddush and shalosh seudos together.
  const byDate = new Map<string, typeof slots>();
  for (const s of slots) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  return (
    <>
      <PageHeader
        eyebrow="Kiddush &amp; Shalosh Seudos"
        title="Sponsor a Shabbos"
        titleHe="לחסות"
        subtitle="Mark a simcha, a yahrzeit, or a hakoras hatov by sponsoring the kiddush or shalosh seudos. Pick an open date below and the shul office will confirm it with you."
      />

      <Flash ok={sp.ok} error={sp.error} />

      {byDate.size === 0 ? (
        <Empty>
          No dates are open at the moment.{' '}
          {settings.email ? <a href={`mailto:${settings.email}`} className="text-gold-700 hover:underline">Contact the office</a> : 'Contact the office'}{' '}
          and we will arrange one.
        </Empty>
      ) : (
        <div className="space-y-5">
          {[...byDate.entries()].map(([date, list]) => (
            <section key={date} className="card overflow-hidden">
              <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gold-200 bg-gold-50/60 px-5 py-3">
                <div>
                  <h2 className="text-base font-semibold">{fmtDate(date, tz, 'cccc, LLLL d, yyyy')}</h2>
                  {list[0]?.label && <p className="text-sm text-gold-800">{list[0].label}</p>}
                </div>
                <span className="text-xs text-walnut-400">
                  {Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)} days away
                </span>
              </header>

              <div className="divide-y divide-gold-100">
                {list.map((slot) => {
                  const kind = KIND_LABELS[slot.kind] ?? { en: slot.kind, he: '' };
                  const open = slot.status === 'open';

                  return (
                    <div key={slot.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <h3 className="text-sm font-semibold text-walnut-800">{kind.en}</h3>
                            {kind.he && <span className="he font-hebrew text-sm text-gold-700">{kind.he}</span>}
                            <Badge value={slot.status} />
                          </div>
                          {slot.sponsorName && (
                            <p className="mt-1 text-sm text-walnut-600">
                              Sponsored by <strong className="text-walnut-800">{slot.sponsorName}</strong>
                              {slot.occasion && <span className="text-walnut-500"> — {slot.occasion}</span>}
                            </p>
                          )}
                          {slot.coSponsors && (
                            <p className="text-xs text-walnut-500">with {slot.coSponsors}</p>
                          )}
                        </div>

                        {slot.amountCents > 0 && (
                          <span className="shrink-0 font-display text-lg font-semibold tabular-nums text-gold-700">
                            {formatMoney(slot.amountCents)}
                          </span>
                        )}
                      </div>

                      {open && (
                        <details className="mt-3 group" open={sp.date === date}>
                          <summary className="cursor-pointer list-none">
                            <span className="btn-gold btn-sm">Sponsor this {kind.en.toLowerCase()}</span>
                          </summary>

                          <form action={requestSponsorshipAction} className="mt-4 grid gap-3 rounded-lg border border-gold-200 bg-gold-50/40 p-4 sm:grid-cols-2">
                            <input type="hidden" name="id" value={slot.id} />
                            <div>
                              <label className="label" htmlFor={`name-${slot.id}`}>Listed as</label>
                              <input
                                id={`name-${slot.id}`}
                                name="sponsorName"
                                required
                                defaultValue={user ? `${user.firstName} ${user.lastName}` : ''}
                                placeholder="The Cohen family"
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="label" htmlFor={`amt-${slot.id}`}>Amount</label>
                              <input
                                id={`amt-${slot.id}`}
                                name="amountCents"
                                inputMode="decimal"
                                defaultValue={(slot.amountCents / 100).toString()}
                                className="input tabular-nums"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="label" htmlFor={`occ-${slot.id}`}>In honour / in memory of</label>
                              <input
                                id={`occ-${slot.id}`}
                                name="occasion"
                                maxLength={200}
                                placeholder="לזכר נשמת… · In honour of our son's bar mitzvah"
                                className="input"
                              />
                            </div>
                            {!user && (
                              <>
                                <div>
                                  <label className="label" htmlFor={`em-${slot.id}`}>Email</label>
                                  <input id={`em-${slot.id}`} name="donorEmail" type="email" className="input" />
                                </div>
                                <div>
                                  <label className="label" htmlFor={`ph-${slot.id}`}>Phone</label>
                                  <input id={`ph-${slot.id}`} name="donorPhone" type="tel" className="input" />
                                </div>
                              </>
                            )}
                            <div className="sm:col-span-2">
                              <button type="submit" className="btn-primary w-full">Request this date</button>
                              <p className="mt-2 text-xs text-walnut-400">
                                Nothing is charged now. The office will confirm and arrange payment with you.
                              </p>
                            </div>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card className="mt-8" title="Prefer to give another way?">
        <p className="text-sm text-walnut-600">
          You can also{' '}
          <Link href="/donate" className="font-semibold text-gold-700 hover:underline">make a straight donation</Link>{' '}
          towards the kiddush fund, or speak to a gabbai in shul.
        </p>
      </Card>
    </>
  );
}
