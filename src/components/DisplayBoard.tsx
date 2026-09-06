'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import type { DisplayData } from '@/lib/displayData';
import { Crest } from './Crest';

/** How often the board asks the server for fresh data. */
const POLL_MS = 60_000;

export function DisplayBoard({ initial }: { initial: DisplayData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [panelIndex, setPanelIndex] = useState(0);

  const tz = data.timezone;
  const he = data.language === 'hebrew';
  /** Picks the Hebrew or English wording for the board's own labels. */
  const t = useCallback((hebrew: string, english: string) => (he ? hebrew : english), [he]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const preview = data.previewOf;

  const refresh = useCallback(async () => {
    try {
      // Keep re-polling whatever date the board was opened on.
      const url = preview ? `/api/display?date=${preview}` : '/api/display';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      // A blip in the network shouldn't blank the shul's board — keep showing
      // the last good data and try again on the next tick.
    }
  }, [preview]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Roll over to the new day's data the moment midnight passes.
  useEffect(() => {
    if (preview) return;
    const todayIso = DateTime.fromMillis(now, { zone: tz }).toISODate();
    if (todayIso && todayIso !== data.today.iso) refresh();
  }, [now, tz, data.today.iso, preview, refresh]);

  const panels = useMemo(() => buildPanels(data, t), [data, t]);

  useEffect(() => {
    if (panels.length <= 1) return;
    const id = setInterval(
      () => setPanelIndex((i) => (i + 1) % panels.length),
      Math.max(5, data.rotateSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [panels.length, data.rotateSeconds]);

  const panel = panels[panelIndex % Math.max(1, panels.length)];
  const clock = DateTime.fromMillis(now, { zone: tz });
  const nextMinyan = data.upNext.find((m) => m.at >= now) ?? data.upNext[0];

  return (
    <div
      dir={he ? 'rtl' : 'ltr'}
      className={`display-root flex h-screen w-screen flex-col overflow-hidden ${he ? 'font-hebrew' : ''}`}
    >
      {/* ---------------- Header ---------------- */}
      <header className="flex shrink-0 items-center justify-between gap-6 border-b-2 border-gold-600/50 px-8 py-3">
        <div className="min-w-0 shrink-0">
          <Crest
            variant="mark-light"
            size="md"
            dark
            nameHe={data.shul.nameHe}
            nameEn={data.shul.nameEn}
          />
        </div>

        {/* Parsha is the thing people look up first, so it leads. */}
        <div className="min-w-0 text-center">
          {data.today.parshaHe && (
            <p className="he font-hebrew text-5xl font-bold leading-none text-ivory-50 2xl:text-6xl">
              {he ? data.today.parshaHe : `Parashas ${data.today.parshaEn}`}
            </p>
          )}
          <p className={`he font-hebrew text-2xl text-gold-300 2xl:text-3xl ${data.today.parshaHe ? 'mt-2' : ''}`}>
            {he ? data.today.hebrewHe : data.today.hebrewEn}
          </p>
          <p className="bidi-isolate mt-0.5 text-sm text-ivory-100/55">{data.today.civil}</p>
          {data.today.motzeiAt && (
            <p className="mt-1 text-2xl text-gold-200">
              {t('מוצאי שבת', 'Shabbos ends')}{' '}
              <span className="ltr-run font-display font-semibold tabular-nums">
                {DateTime.fromMillis(data.today.motzeiAt, { zone: tz }).toFormat('h:mm')}
              </span>
            </p>
          )}
        </div>

        <div className="ltr-run shrink-0 text-end">
          <p className="font-display text-6xl font-semibold leading-none tabular-nums text-ivory-50 2xl:text-7xl">
            {clock.toFormat('h:mm')}
            <span className="ms-1 align-baseline text-3xl text-gold-400">:{clock.toFormat('ss')}</span>
            <span className="ms-2 align-baseline text-2xl uppercase tracking-widest text-gold-500">
              {clock.toFormat('a')}
            </span>
          </p>
        </div>
      </header>

      {/* Holidays / omer strip */}
      {(data.today.holidays.length > 0 || data.today.omer) && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-8 border-b border-gold-700/30 bg-gold-500/10 px-8 py-1.5">
          {data.today.holidays.map((h) => (
            <span key={h.en} className="text-2xl font-semibold text-gold-200">{he ? h.he : h.en}</span>
          ))}
          {data.today.omer && (
            <span className="text-2xl text-ivory-100/80">
              {t(`היום ${data.today.omer} לעומר`, `Day ${data.today.omer} of the Omer`)}
            </span>
          )}
        </div>
      )}

      {/* ---------------- Body ---------------- */}
      {/* A flyer is a finished design and unreadable at column width, so for
          its slot it takes the whole body. The header and tefillah band stay,
          and the columns come back on the next rotation. */}
      {panel?.fill ? (
        <div className="animate-fade-up flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className="flex min-h-0 flex-1 items-center justify-center">{panel.render(tz)}</div>
          {panels.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {panels.map((p, i) => (
                <span
                  key={p.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === panelIndex % panels.length ? 'w-7 bg-gold-400' : 'w-1.5 bg-gold-700/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="flex min-h-0 flex-1">
        {/* זמני היום */}
        <Column title={t('זמני היום', 'Zmanim')} className="w-[26%] border-e border-gold-700/40">
          <dl>
            {data.zmanim.map((z) => (
              <Row
                key={z.id}
                label={he ? z.labelHe : z.label}
                hebrewFont={he}
                value={
                  z.isDuration
                    ? z.minutes != null ? `${z.minutes}${t(' דק׳', ' min')}` : '—'
                    : z.at ? DateTime.fromMillis(z.at, { zone: tz }).toFormat('h:mm') : '—'
                }
              />
            ))}
          </dl>
        </Column>

        {/* Middle: davening, then the rotating panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Column title={t('זמני התפילה', 'Davening')} className="min-h-0 flex-none border-b border-gold-700/40">
            <dl>
              {data.minyanimToday.length === 0 ? (
                <p className="py-3 text-center text-lg text-ivory-100/40">
                  {t('אין תפילות רשומות', 'No minyanim listed')}
                </p>
              ) : (
                data.minyanimToday.map((m, i) => {
                  const isNext = nextMinyan != null && m.at === nextMinyan.at && m.name === nextMinyan.name;
                  return (
                    <Row
                      key={i}
                      label={he ? m.nameHe || m.name : m.name}
                      hebrewFont={he}
                      sub={m.location ?? undefined}
                      value={m.at ? DateTime.fromMillis(m.at, { zone: tz }).toFormat('h:mm') : '—'}
                      highlight={isNext}
                    />
                  );
                })
              )}
            </dl>

            {nextMinyan && (
              <p className="mt-2 rounded-lg bg-gold-500/20 px-4 py-1.5 text-center text-xl text-gold-100">
                {t('התפילה הבאה', 'Next')}: <strong>{he ? nextMinyan.nameHe || nextMinyan.name : nextMinyan.name}</strong>
                {' · '}
                <span className="bidi-isolate">{countdown(nextMinyan.at, now, tz, t)}</span>
              </p>
            )}
          </Column>

          <div className="flex min-h-0 flex-1 flex-col px-6 py-3">
            {panel ? (
              <section key={`${panel.key}-${panelIndex}`} className="animate-fade-up flex min-h-0 flex-1 flex-col">
                {!panel.fill && (
                  <h2 className="mb-2 text-center text-xl font-semibold uppercase tracking-[0.15em] text-gold-500">
                    {panel.title}
                  </h2>
                )}
                <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">{panel.render(tz)}</div>
              </section>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="he font-hebrew text-4xl text-gold-600/30">ברוכים הבאים</p>
              </div>
            )}

            {panels.length > 1 && (
              <div className="mt-2 flex justify-center gap-1.5">
                {panels.map((p, i) => (
                  <span
                    key={p.key}
                    className={`h-1.5 rounded-full transition-all ${
                      i === panelIndex % panels.length ? 'w-7 bg-gold-400' : 'w-1.5 bg-gold-700/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* לימוד יומי */}
        <Column title={t('לימוד יומי', 'Daily Learning')} className="w-[26%] border-s border-gold-700/40">
          {data.learning.length === 0 ? (
            <p className="py-3 text-center text-lg text-ivory-100/40">—</p>
          ) : (
            <ul className="space-y-3">
              {data.learning.map((l) => (
                <li key={l.key} className="border-b border-gold-700/20 pb-3 last:border-0">
                  <p className="text-lg text-gold-500">{he ? l.labelHe : l.labelEn}</p>
                  <p className={`mt-0.5 text-2xl leading-snug text-ivory-50 2xl:text-3xl ${he ? 'font-hebrew' : ''}`}>
                    {he ? l.valueHe : l.valueEn}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Column>
      </div>
      )}

      {/* ---------------- Tefillah band ---------------- */}
      {data.tefillah && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-7 gap-y-1 border-t-2 border-gold-600/50 bg-gold-500/10 px-8 py-2">
          {data.tefillah.insertions.map((ins) => (
            <span key={ins.key} className="text-2xl font-semibold text-gold-100 2xl:text-3xl">
              {he ? ins.he : ins.en}
              {(he ? ins.note : ins.noteEn ?? ins.note) && (
                <span className="ms-2 text-lg text-gold-400">{he ? ins.note : ins.noteEn ?? ins.note}</span>
              )}
            </span>
          ))}

          <span className={`text-2xl 2xl:text-3xl ${data.tefillah.tachanun.said ? 'text-ivory-100/75' : 'text-gold-200 font-semibold'}`}>
            {he ? data.tefillah.tachanun.he : data.tefillah.tachanun.said ? 'Tachanun' : 'No Tachanun'}
          </span>

          {data.tefillah.hallel && (
            <span className="text-2xl font-semibold text-gold-100 2xl:text-3xl">
              {he ? data.tefillah.hallel.he : data.tefillah.hallel.en}
            </span>
          )}

          {data.tefillah.kiddushLevana?.openTonight && (
            <span className="text-2xl text-gold-200 2xl:text-3xl">
              {t('קידוש לבנה עד', 'Kiddush Levana until')} {data.tefillah.kiddushLevana.untilLabelHe}
            </span>
          )}

          {data.tefillah.molad && (
            <span className="text-xl text-gold-300">
              {t(`מברכין חודש ${data.tefillah.molad.monthHe}`, `Molad ${data.tefillah.molad.monthHe}`)}
              {' · '}
              <span dir="auto">{he ? data.tefillah.molad.he : data.tefillah.molad.en}</span>
            </span>
          )}
        </div>
      )}

      {/* ---------------- Footer ---------------- */}
      <footer className="flex shrink-0 items-center justify-between gap-6 border-t border-gold-700/40 px-8 py-2">
        {data.showYahrzeits && data.yahrzeitsToday.length > 0 ? (
          <p className="min-w-0 flex-1 truncate text-start">
            <span className="text-lg text-gold-500">{t('לזכר נשמת', 'Yahrzeit today')} · </span>
            <span className="he font-hebrew text-2xl text-gold-100">
              {data.yahrzeitsToday.map((y) => y.nameHe || y.name).join(' · ')}
            </span>
          </p>
        ) : (
          <p className="he min-w-0 flex-1 truncate text-start font-hebrew text-base text-gold-600/70">
            {data.shul.dedicationHe}
          </p>
        )}

        {data.standingMessage && (
          <p dir="auto" className="shrink-0 text-lg font-medium text-gold-300">{data.standingMessage}</p>
        )}

        <p className="he min-w-0 flex-1 truncate text-end font-hebrew text-base text-gold-600/70">
          {data.shul.nasiHe}
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Column({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col px-6 py-3 ${className}`}>
      <h2 className="mb-2 shrink-0 border-b border-gold-700/40 pb-1.5 text-center text-xl font-semibold uppercase tracking-[0.15em] text-gold-500">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

/** One label/time line. `highlight` marks the minyan that is coming next. */
function Row({
  label,
  sub,
  value,
  highlight = false,
  hebrewFont = true,
}: {
  label: string;
  sub?: string;
  value: string;
  highlight?: boolean;
  /** Off for the English board, where the Hebrew serif is the wrong face. */
  hebrewFont?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-gold-700/20 py-[0.3rem] last:border-0 ${
        highlight ? '-mx-2 rounded bg-gold-500/20 px-2' : ''
      }`}
    >
      <dt className="min-w-0">
        <span className={`block truncate text-2xl 2xl:text-3xl ${hebrewFont ? 'font-hebrew' : ''} ${highlight ? 'text-gold-100' : 'text-ivory-100/85'}`}>
          {label}
        </span>
        {sub && <span className="bidi-isolate block truncate text-sm text-ivory-100/40">{sub}</span>}
      </dt>
      <dd className={`ltr-run shrink-0 font-display text-3xl font-semibold tabular-nums 2xl:text-4xl ${highlight ? 'text-gold-200' : 'text-gold-300'}`}>
        {value}
      </dd>
    </div>
  );
}

function countdown(at: number, now: number, tz: string, t: (he: string, en: string) => string): string {
  const minutes = Math.round((at - now) / 60000);
  if (minutes < 0 || minutes >= 90) return DateTime.fromMillis(at, { zone: tz }).toFormat('h:mm a');
  if (minutes === 0) return t('עכשיו', 'now');
  return t(`בעוד ${minutes} דקות`, `in ${minutes} min`);
}

/* ------------------------------------------------------------------ */
/* Rotating panels — only the ones with something to say get in.       */
/* ------------------------------------------------------------------ */

interface Panel {
  key: string;
  title: string;
  /** Drops the panel heading so a flyer gets the full height. */
  fill?: boolean;
  render: (tz: string) => React.ReactNode;
}

function buildPanels(data: DisplayData, t: (he: string, en: string) => string): Panel[] {
  const panels: Panel[] = [];
  const he = data.language === 'hebrew';

  for (const [i, a] of data.announcements.entries()) {
    panels.push({
      key: `ann-${i}`,
      title: a.priority === 'urgent' ? t('חשוב', 'Important') : t('הודעה', 'Announcement'),
      // A flyer is already a finished design — it fills the panel and the
      // title and body stay on the website.
      fill: Boolean(a.imageUrl),
      render: () =>
        a.imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.imageUrl}
              alt={a.title}
              width={a.imageWidth ?? undefined}
              height={a.imageHeight ?? undefined}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        ) : (
          <div dir="auto" className="text-center">
            <h3 className={`text-4xl font-semibold leading-tight 2xl:text-5xl ${a.priority === 'urgent' ? 'text-rose-300' : 'text-ivory-50'}`}>
              {a.title}
            </h3>
            {a.body && (
              <p dir="auto" className="mt-3 whitespace-pre-line text-2xl leading-snug text-ivory-100/70 2xl:text-3xl">
                {a.body}
              </p>
            )}
          </div>
        ),
    });
  }

  if (data.shiurimToday.length > 0) {
    panels.push({
      key: 'shiurim',
      title: t('שיעורים היום', "Today's Shiurim"),
      render: (tz) => (
        <ul className="space-y-2">
          {data.shiurimToday.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-5 border-b border-gold-700/20 pb-2 last:border-0">
              <span className="min-w-0">
                <span className={`block truncate text-2xl text-ivory-100/90 2xl:text-3xl ${he ? 'font-hebrew' : ''}`}>
                  {he ? s.titleHe || s.title : s.title}
                </span>
                <span dir="auto" className="block truncate text-base text-ivory-100/45">
                  {[s.maggidShiur, s.location].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 font-display text-3xl font-semibold tabular-nums text-gold-200">
                {s.at ? DateTime.fromMillis(s.at, { zone: tz }).toFormat('h:mm') : '—'}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.showSponsors && data.sponsors.length > 0) {
    panels.push({
      key: 'sponsors',
      title: t('תזכו למצוות', 'With thanks to our sponsors'),
      render: () => (
        <ul className="space-y-3 text-center">
          {data.sponsors.slice(0, 4).map((s, i) => (
            <li key={i}>
              <p dir="auto" className="text-base uppercase tracking-widest text-gold-500">{s.kind} · {s.dateLabel}</p>
              <p dir="auto" className="text-3xl font-semibold text-ivory-50 2xl:text-4xl">{s.sponsorName}</p>
              {s.occasion && <p dir="auto" className="text-xl text-gold-300/85">{s.occasion}</p>}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.showYahrzeits && data.yahrzeitsSoon.length > 0) {
    panels.push({
      key: 'yahrzeits',
      title: t('יארצייטן השבוע', 'Yahrzeits this week'),
      render: () => (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
          {data.yahrzeitsSoon.map((y, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 border-b border-gold-700/20 py-1">
              <span className="he min-w-0 truncate font-hebrew text-xl text-ivory-100/85">{y.nameHe || y.name}</span>
              <span dir="auto" className="shrink-0 text-base text-gold-400">{y.when}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.upcomingEvents.length > 0) {
    panels.push({
      key: 'events',
      title: t('אירועים', 'Coming up'),
      render: () => (
        <ul className="space-y-3 text-center">
          {data.upcomingEvents.map((e, i) => (
            <li key={i}>
              <p dir="auto" className="text-3xl font-semibold text-ivory-50">{e.title}</p>
              <p dir="auto" className="text-xl text-gold-300">
                {e.when}
                {e.location && <span className="text-ivory-100/50"> · {e.location}</span>}
              </p>
            </li>
          ))}
        </ul>
      ),
    });
  }

  return panels;
}
