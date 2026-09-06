'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import type { DisplayData } from '@/lib/displayData';
import { Crest } from './Crest';
import { FiligreeEdges, Flourish, Panel, BoardGround } from './BoardOrnament';

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
      className={`display-root relative flex h-screen w-screen flex-col overflow-hidden ${he ? 'font-hebrew' : ''}`}
    >
      <BoardGround />
      <FiligreeEdges />

      {/* Everything sits inside the filigree border. */}
      <div className="relative flex min-h-0 flex-1 flex-col px-[62px] py-3">
        {/* ---------------- Header ---------------- */}
        <header className="flex shrink-0 items-center justify-between gap-6">
          <div className="flex w-[26%] shrink-0 justify-start">
            <Crest variant="mark-light" size="board" dark nameHe={data.shul.nameHe} nameEn={data.shul.nameEn} />
          </div>

          <div className="min-w-0 flex-1 text-center">
            {data.today.parshaHe ? (
              <p
                className="he font-hebrew text-[3.6rem] font-bold leading-none text-[#FBEFCF] 2xl:text-7xl"
                style={{ textShadow: '0 2px 10px rgba(0,0,0,.55)' }}
              >
                {he ? data.today.parshaHe : `Parashas ${data.today.parshaEn}`}
              </p>
            ) : (
              data.today.holidays[0] && (
                <p
                  className="he font-hebrew text-[3.2rem] font-bold leading-none text-[#FBEFCF] 2xl:text-6xl"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,.55)' }}
                >
                  {he ? data.today.holidays[0].he : data.today.holidays[0].en}
                </p>
              )
            )}
            <div className="flex justify-center"><Flourish className="my-1.5" width={340} /></div>
            <p className="he font-hebrew text-2xl text-gold-300 2xl:text-3xl">
              {he ? data.today.hebrewHe : data.today.hebrewEn}
            </p>
            <p className="bidi-isolate text-sm text-ivory-100/55">
              {data.today.civil}
              {data.today.motzeiAt && (
                <>
                  {' · '}
                  <span className="text-gold-300">
                    {t('מוצאי שבת', 'Shabbos ends')}{' '}
                    <span className="ltr-run font-semibold tabular-nums">
                      {DateTime.fromMillis(data.today.motzeiAt, { zone: tz }).toFormat('h:mm')}
                    </span>
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex w-[26%] shrink-0 justify-end ltr-run">
            <p className="font-display text-[3.4rem] font-semibold leading-none tabular-nums text-ivory-50 2xl:text-7xl">
              {clock.toFormat('h:mm')}
              <span className="ms-1 align-baseline text-2xl text-gold-400">:{clock.toFormat('ss')}</span>
              <span className="ms-2 align-baseline text-xl uppercase tracking-[0.2em] text-gold-500">
                {clock.toFormat('a')}
              </span>
            </p>
          </div>
        </header>

        {/* Holidays / omer / daf strip */}
        {(data.today.holidays.length > 0 || data.today.omer || (data.showDaf && data.today.dafYomi)) && (
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-8 text-xl text-gold-300 2xl:text-2xl">
            {data.today.parshaHe && data.today.holidays.map((h) => (
              <span key={h.en} className="font-semibold">{he ? h.he : h.en}</span>
            ))}
            {data.today.omer && <span>{t(`היום ${data.today.omer} לעומר`, `Day ${data.today.omer} of the Omer`)}</span>}
            {data.showDaf && data.today.dafYomi && (
              <span className="text-ivory-100/70">
                {t('דף היומי', 'Daf Yomi')} · {he ? data.today.dafYomiHe : data.today.dafYomi}
              </span>
            )}
          </div>
        )}

        {/* ---------------- Body ---------------- */}
        {panel?.fill ? (
          <div className="animate-fade-up mt-3 flex min-h-0 flex-1 items-center justify-center">
            {panel.render(tz)}
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-1 gap-5">
            <Panel title={t('זמני היום', 'Zmanim')} className="w-[25%]">
              <dl className={data.zmanim.length > 11 ? 'text-[0.86em]' : ''}>
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
            </Panel>

            <Panel title={panel?.title ?? t('הודעות', 'Notices')} className="flex-1" bodyClassName="flex flex-col justify-center">
              {panel ? (
                <div key={`${panel.key}-${panelIndex}`} className="animate-fade-up">
                  {panel.render(tz)}
                </div>
              ) : (
                <p className="he text-center font-hebrew text-4xl text-walnut-300">ברוכים הבאים</p>
              )}
              {panels.length > 1 && (
                <div className="mt-4 flex justify-center gap-1.5">
                  {panels.map((p, i) => (
                    <span
                      key={p.key}
                      className={`h-1.5 rounded-full transition-all ${
                        i === panelIndex % panels.length ? 'w-7 bg-gold-700' : 'w-1.5 bg-walnut-900/25'
                      }`}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title={t('לימוד יומי', 'Daily Learning')} className="w-[25%]" bodyClassName="flex flex-col justify-center">
              {data.learning.length === 0 ? (
                <p className="py-3 text-center text-lg text-walnut-400">—</p>
              ) : (
                <ul className="space-y-5">
                  {data.learning.map((l) => (
                    <li key={l.key} className="border-b border-walnut-900/10 pb-4 last:border-0 last:pb-0">
                      <p className="text-base uppercase tracking-wider text-gold-800">
                        {he ? l.labelHe : l.labelEn}
                      </p>
                      <p className={`mt-0.5 text-2xl font-medium leading-snug text-walnut-800 2xl:text-[1.7rem] ${he ? 'font-hebrew' : ''}`}>
                        {he ? l.valueHe : l.valueEn}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        {/* ---------------- Davening, full width ---------------- */}
        {!panel?.fill && (
          <Panel title={t('זמני התפילה', 'Davening')} arched={false} className="mt-5 shrink-0" bodyClassName="pt-1 pb-2">
            {data.minyanimToday.length === 0 ? (
              <p className="py-2 text-center text-xl text-walnut-400">
                {t('אין תפילות רשומות', 'No minyanim listed')}
              </p>
            ) : (
              <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-2">
                {data.minyanimToday.map((m, i) => {
                  const isNext = nextMinyan != null && m.at === nextMinyan.at && m.name === nextMinyan.name;
                  return (
                    <div
                      key={i}
                      className={`min-w-[8.5rem] rounded-lg px-5 py-1.5 text-center ring-1 ${
                        isNext
                          ? 'bg-gold-300/70 ring-walnut-600'
                          : 'bg-walnut-900/[0.05] ring-walnut-900/15'
                      }`}
                    >
                      <p className={`text-xl leading-tight text-walnut-700 2xl:text-2xl ${he ? 'font-hebrew' : ''}`}>
                        {he ? m.nameHe || m.name : m.name}
                      </p>
                      <p className="ltr-run font-display text-4xl font-bold leading-tight tabular-nums text-walnut-900 2xl:text-5xl">
                        {m.at ? DateTime.fromMillis(m.at, { zone: tz }).toFormat('h:mm') : '—'}
                      </p>
                      {isNext && (
                        <p className="bidi-isolate text-sm font-semibold text-walnut-700">
                          {countdown(m.at!, now, tz, t)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {/* ---------------- Tefillah band ---------------- */}
        {data.tefillah && !panel?.fill && (
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-x-7 gap-y-1">
            {data.tefillah.insertions.map((ins) => (
              <span key={ins.key} className="text-2xl font-semibold text-gold-100 2xl:text-[1.6rem]">
                {he ? ins.he : ins.en}
                {(he ? ins.note : ins.noteEn ?? ins.note) && (
                  <span className="ms-2 text-lg text-gold-400">{he ? ins.note : ins.noteEn ?? ins.note}</span>
                )}
              </span>
            ))}
            <span className={`text-2xl 2xl:text-[1.6rem] ${data.tefillah.tachanun.said ? 'text-ivory-100/70' : 'font-semibold text-gold-100'}`}>
              {he ? data.tefillah.tachanun.he : data.tefillah.tachanun.said ? 'Tachanun' : 'No Tachanun'}
            </span>
            {data.tefillah.hallel && (
              <span className="text-2xl font-semibold text-gold-100 2xl:text-[1.6rem]">
                {he ? data.tefillah.hallel.he : data.tefillah.hallel.en}
              </span>
            )}
            {data.tefillah.kiddushLevana?.openTonight && (
              <span className="bidi-isolate text-2xl text-gold-200 2xl:text-[1.6rem]">
                {t('קידוש לבנה עד', 'Kiddush Levana until')} {data.tefillah.kiddushLevana.untilLabelHe}
              </span>
            )}
            {data.tefillah.molad && (
              <span className="text-lg text-gold-400">
                {t(`מברכין חודש ${data.tefillah.molad.monthHe}`, `Molad ${data.tefillah.molad.monthHe}`)}
                {' · '}
                <span dir="auto">{he ? data.tefillah.molad.he : data.tefillah.molad.en}</span>
              </span>
            )}
          </div>
        )}

        {/* ---------------- Footer ---------------- */}
        <footer className="mt-2 flex shrink-0 items-center justify-between gap-6 border-t border-gold-700/40 pt-1.5">
          {data.showYahrzeits && data.yahrzeitsToday.length > 0 ? (
            <p className="min-w-0 flex-1 truncate text-start">
              <span className="text-base text-gold-500">{t('לזכר נשמת', 'Yahrzeit today')} · </span>
              <span className="he font-hebrew text-xl text-gold-100">
                {data.yahrzeitsToday.map((y) => y.nameHe || y.name).join(' · ')}
              </span>
            </p>
          ) : (
            <p className="he min-w-0 flex-1 truncate text-start font-hebrew text-base text-gold-600/70">
              {data.shul.dedicationHe}
            </p>
          )}
          {data.standingMessage && (
            <p dir="auto" className="shrink-0 text-base font-medium text-gold-300">{data.standingMessage}</p>
          )}
          <p className="he min-w-0 flex-1 truncate text-end font-hebrew text-base text-gold-600/70">
            {data.shul.nasiHe}
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
      className={`flex items-baseline justify-between gap-3 rounded px-2 py-[0.25rem] ${
        highlight ? 'bg-gold-300/60 ring-1 ring-walnut-600' : 'odd:bg-walnut-900/[0.045]'
      }`}
    >
      <dt className="min-w-0">
        <span className={`block truncate text-[1.5em] text-walnut-700 ${hebrewFont ? 'font-hebrew' : ''}`}>
          {label}
        </span>
        {sub && <span className="bidi-isolate block truncate text-sm text-walnut-500">{sub}</span>}
      </dt>
      <dd className="ltr-run shrink-0 font-display text-[1.75em] font-bold tabular-nums text-walnut-900">
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
            <h3 className={`text-5xl font-bold leading-tight 2xl:text-6xl ${a.priority === 'urgent' ? 'text-rose-800' : 'text-walnut-900'}`}>
              {a.title}
            </h3>
            {a.body && (
              <p dir="auto" className="mt-5 whitespace-pre-line text-3xl leading-snug text-walnut-700 2xl:text-4xl">
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
            <li key={i} className="flex items-baseline justify-between gap-5 border-b border-walnut-900/10 pb-2 last:border-0">
              <span className="min-w-0">
                <span className={`block truncate text-2xl text-walnut-800 2xl:text-3xl ${he ? 'font-hebrew' : ''}`}>
                  {he ? s.titleHe || s.title : s.title}
                </span>
                <span dir="auto" className="block truncate text-base text-walnut-500">
                  {[s.maggidShiur, s.location].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="ltr-run shrink-0 font-display text-3xl font-bold tabular-nums text-walnut-900">
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
              <p dir="auto" className="text-base uppercase tracking-widest text-gold-800">{s.kind} · {s.dateLabel}</p>
              <p dir="auto" className="text-3xl font-bold text-walnut-900 2xl:text-4xl">{s.sponsorName}</p>
              {s.occasion && <p dir="auto" className="text-xl text-walnut-600">{s.occasion}</p>}
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
            <li key={i} className="flex items-baseline justify-between gap-3 border-b border-walnut-900/10 py-1">
              <span className="he min-w-0 truncate font-hebrew text-xl text-walnut-800">{y.nameHe || y.name}</span>
              <span dir="auto" className="shrink-0 text-base text-walnut-500">{y.when}</span>
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
              <p dir="auto" className="text-3xl font-bold text-walnut-900">{e.title}</p>
              <p dir="auto" className="text-xl text-walnut-600">
                {e.when}
                {e.location && <span className="text-walnut-400"> · {e.location}</span>}
              </p>
            </li>
          ))}
        </ul>
      ),
    });
  }

  return panels;
}
