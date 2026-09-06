'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { DateTime } from 'luxon';
import type { DisplayData } from '@/lib/displayData';

/** How often the board asks the server for fresh data. */
const POLL_MS = 60_000;

export function DisplayBoard({ initial }: { initial: DisplayData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [panelIndex, setPanelIndex] = useState(0);

  const tz = data.timezone;

  // Live clock. One second is enough; the board never shows seconds ticking on
  // anything but the headline time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/display', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      // A blip in the network shouldn't blank the shul's board — keep showing
      // the last good data and try again on the next tick.
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Roll over to the new day's data the moment midnight passes.
  useEffect(() => {
    const todayIso = DateTime.fromMillis(now, { zone: tz }).toISODate();
    if (todayIso && todayIso !== data.today.iso) refresh();
  }, [now, tz, data.today.iso, refresh]);

  const panels = useMemo(() => buildPanels(data), [data]);

  useEffect(() => {
    if (panels.length <= 1) return;
    const id = setInterval(
      () => setPanelIndex((i) => (i + 1) % panels.length),
      Math.max(5, data.rotateSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [panels.length, data.rotateSeconds]);

  // Keep the index valid when the panel list changes underneath us.
  const panel = panels[panelIndex % Math.max(1, panels.length)];

  const clock = DateTime.fromMillis(now, { zone: tz });

  return (
    <div className="display-root flex h-screen w-screen flex-col overflow-hidden">
      {/* ------------- Header ------------- */}
      <header className="flex items-center justify-between gap-6 border-b border-gold-700/40 px-8 py-4">
        <div className="min-w-0">
          <h1 className="he font-hebrew text-4xl font-bold leading-none text-gold-200 2xl:text-5xl">
            {data.shul.nameHe}
          </h1>
          <p className="mt-1.5 truncate font-display text-sm uppercase tracking-[0.25em] text-gold-500/80 2xl:text-base">
            {data.shul.nameEn}
          </p>
        </div>

        <div className="text-center">
          <p className="he font-hebrew text-3xl text-gold-300 2xl:text-4xl">{data.today.hebrewHe}</p>
          {data.today.parshaHe && (
            <p className="he mt-1 font-hebrew text-2xl text-gold-500 2xl:text-3xl">{data.today.parshaHe}</p>
          )}
          <p className="mt-1 text-sm text-ivory-100/60 2xl:text-base">{data.today.civil}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display text-6xl font-semibold leading-none tabular-nums text-ivory-50 2xl:text-7xl">
            {clock.toFormat('h:mm')}
            <span className="ml-2 text-3xl text-gold-500 2xl:text-4xl">{clock.toFormat('a')}</span>
          </p>
          <p className="mt-1 text-sm tabular-nums text-ivory-100/50">{clock.toFormat('ss')} sec</p>
        </div>
      </header>

      {/* Holidays / omer / daf strip */}
      {(data.today.holidays.length > 0 || data.today.omer || (data.showDaf && data.today.dafYomi)) && (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1 border-b border-gold-700/25 bg-gold-500/5 px-8 py-2">
          {data.today.holidays.map((h) => (
            <span key={h} className="text-xl font-semibold text-gold-300 2xl:text-2xl">{h}</span>
          ))}
          {data.today.omer && (
            <span className="text-xl text-ivory-100/80 2xl:text-2xl">Omer — day {data.today.omer}</span>
          )}
          {data.showDaf && data.today.dafYomi && (
            <span className="text-xl text-ivory-100/80 2xl:text-2xl">
              Daf Yomi · {data.today.dafYomi}
              {data.today.dafYomiHe && <span className="he ml-3 font-hebrew text-gold-400">{data.today.dafYomiHe}</span>}
            </span>
          )}
        </div>
      )}

      {/* ------------- Body ------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail: what is happening next, then the day's zmanim */}
        <aside className="flex w-[34%] min-w-0 flex-col border-r border-gold-700/40 px-8 py-5">
          <UpNext upNext={data.upNext} now={now} tz={tz} />

          <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">
            Zmanim
          </h2>
          <dl className="min-h-0 flex-1 overflow-hidden">
            {data.zmanim.map((z) => (
              <div key={z.id} className="flex items-baseline justify-between gap-3 border-b border-gold-700/20 py-[0.45rem] last:border-0">
                <dt className="min-w-0">
                  <span className="block truncate text-base text-ivory-100/85 2xl:text-lg">{z.label}</span>
                </dt>
                <dd className="shrink-0 font-display text-2xl font-semibold tabular-nums text-gold-200 2xl:text-3xl">
                  {z.at ? DateTime.fromMillis(z.at, { zone: tz }).toFormat('h:mm') : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* Right: the rotating panel */}
        <main className="flex min-w-0 flex-1 flex-col px-8 py-5">
          {panel ? (
            <section key={`${panel.key}-${panelIndex}`} className="animate-fade-up flex min-h-0 flex-1 flex-col">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="font-display text-3xl font-semibold text-gold-200 2xl:text-4xl">{panel.title}</h2>
                {panel.titleHe && <span className="he font-hebrew text-2xl text-gold-500 2xl:text-3xl">{panel.titleHe}</span>}
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
                {panel.render(tz)}
              </div>
            </section>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="he font-hebrew text-5xl text-gold-500/40">ברוכים הבאים</p>
            </div>
          )}

          {/* Which panel we're on */}
          {panels.length > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {panels.map((p, i) => (
                <span
                  key={p.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === panelIndex % panels.length ? 'w-8 bg-gold-400' : 'w-1.5 bg-gold-700/60'
                  }`}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ------------- Footer ------------- */}
      <footer className="flex items-center justify-between gap-6 border-t border-gold-700/40 px-8 py-2.5">
        <p className="he truncate font-hebrew text-base text-gold-600/80">{data.shul.dedicationHe}</p>
        {data.standingMessage && (
          <p className="truncate text-base font-medium text-gold-300">{data.standingMessage}</p>
        )}
        <p className="he truncate font-hebrew text-base text-gold-600/80">{data.shul.nasiHe}</p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UpNext({
  upNext,
  now,
  tz,
}: {
  upNext: DisplayData['upNext'];
  now: number;
  tz: string;
}) {
  const next = upNext.find((m) => m.at >= now) ?? upNext[0];
  if (!next) {
    return (
      <div className="rounded-xl border border-gold-700/40 bg-gold-500/5 px-5 py-6 text-center">
        <p className="text-lg text-ivory-100/50">No further minyanim listed</p>
      </div>
    );
  }

  const minutes = Math.round((next.at - now) / 60000);
  const soon = minutes >= 0 && minutes <= 15;
  const when = DateTime.fromMillis(next.at, { zone: tz });

  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-colors ${
        soon ? 'border-gold-400 bg-gold-500/20' : 'border-gold-700/40 bg-gold-500/5'
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">Next</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-display text-4xl font-semibold text-ivory-50 2xl:text-5xl">
          {next.name}
        </span>
        <span className="shrink-0 font-display text-4xl font-semibold tabular-nums text-gold-200 2xl:text-5xl">
          {when.toFormat('h:mm')}
        </span>
      </div>
      <p className="mt-1 text-base text-ivory-100/60">
        {minutes >= 0 && minutes < 90
          ? minutes === 0 ? 'Starting now' : `in ${minutes} min`
          : when.toFormat('cccc')}
        {next.location && ` · ${next.location}`}
      </p>

      {upNext.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-gold-700/30 pt-2.5">
          {upNext.slice(1, 3).map((m, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-lg text-ivory-100/70">
              <span className="min-w-0 truncate">{m.name}</span>
              <span className="shrink-0 tabular-nums text-gold-400">
                {DateTime.fromMillis(m.at, { zone: tz }).toFormat('h:mm a')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panels — only the ones with something to say get into the rotation. */
/* ------------------------------------------------------------------ */

interface Panel {
  key: string;
  title: string;
  titleHe?: string;
  render: (tz: string) => React.ReactNode;
}

function buildPanels(data: DisplayData): Panel[] {
  const panels: Panel[] = [];

  if (data.minyanimToday.length > 0) {
    panels.push({
      key: 'minyanim',
      title: "Today's Davening",
      titleHe: 'זמני התפילות',
      render: (tz) => (
        <ul className={`grid gap-x-12 gap-y-1 ${data.minyanimToday.length > 6 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {data.minyanimToday.map((m, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 border-b border-gold-700/20 py-2">
              <span className="min-w-0">
                <span className="block truncate text-2xl text-ivory-100/90 2xl:text-3xl">{m.name}</span>
                {m.location && <span className="block truncate text-sm text-ivory-100/45">{m.location}</span>}
              </span>
              <span className="shrink-0 font-display text-3xl font-semibold tabular-nums text-gold-200 2xl:text-4xl">
                {m.at ? DateTime.fromMillis(m.at, { zone: tz }).toFormat('h:mm') : '—'}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.shiurimToday.length > 0) {
    panels.push({
      key: 'shiurim',
      title: "Today's Shiurim",
      titleHe: 'שיעורים',
      render: (tz) => (
        <ul className="space-y-3">
          {data.shiurimToday.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between gap-6 border-b border-gold-700/20 pb-3">
              <span className="min-w-0">
                <span className="block truncate text-3xl text-ivory-100/90 2xl:text-4xl">{s.title}</span>
                <span className="block truncate text-lg text-ivory-100/50">
                  {[s.maggidShiur, s.location].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 font-display text-4xl font-semibold tabular-nums text-gold-200">
                {s.at ? DateTime.fromMillis(s.at, { zone: tz }).toFormat('h:mm a') : '—'}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  for (const [i, a] of data.announcements.entries()) {
    panels.push({
      key: `ann-${i}`,
      title: a.priority === 'urgent' ? 'Important' : 'Announcement',
      titleHe: 'הודעה',
      render: () => (
        <div className="flex h-full flex-col justify-center">
          <h3
            className={`font-display text-5xl font-semibold leading-tight 2xl:text-6xl ${
              a.priority === 'urgent' ? 'text-rose-300' : 'text-ivory-50'
            }`}
          >
            {a.title}
          </h3>
          {a.body && (
            <p className="mt-5 whitespace-pre-line text-3xl leading-snug text-ivory-100/75 2xl:text-4xl">
              {a.body}
            </p>
          )}
        </div>
      ),
    });
  }

  if (data.showSponsors && data.sponsors.length > 0) {
    panels.push({
      key: 'sponsors',
      title: 'With thanks to our sponsors',
      titleHe: 'תזכו למצוות',
      render: () => (
        <ul className="space-y-4">
          {data.sponsors.map((s, i) => (
            <li key={i} className="border-b border-gold-700/20 pb-4 last:border-0">
              <p className="text-lg uppercase tracking-widest text-gold-500">
                {s.kind} · {s.dateLabel}
              </p>
              <p className="mt-1 font-display text-4xl font-semibold text-ivory-50 2xl:text-5xl">{s.sponsorName}</p>
              {s.occasion && <p className="mt-1 text-2xl text-gold-300/85">{s.occasion}</p>}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (data.showYahrzeits && (data.yahrzeitsToday.length > 0 || data.yahrzeitsSoon.length > 0)) {
    panels.push({
      key: 'yahrzeits',
      title: 'Yahrzeits',
      titleHe: 'יארצייטן',
      render: () => (
        <div className="space-y-6">
          {data.yahrzeitsToday.length > 0 && (
            <div>
              <p className="mb-2 text-lg uppercase tracking-widest text-gold-500">Today</p>
              <ul className="space-y-2">
                {data.yahrzeitsToday.map((y, i) => (
                  <li key={i}>
                    {y.nameHe && <p className="he font-hebrew text-4xl text-gold-200 2xl:text-5xl">{y.nameHe}</p>}
                    <p className="text-2xl text-ivory-100/80">
                      {y.name}
                      {y.forFamily && <span className="ml-3 text-lg text-ivory-100/40">· {y.forFamily}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.yahrzeitsSoon.length > 0 && (
            <div>
              <p className="mb-2 text-lg uppercase tracking-widest text-gold-500">This coming week</p>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
                {data.yahrzeitsSoon.map((y, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 border-b border-gold-700/20 py-1.5">
                    <span className="min-w-0 truncate text-xl text-ivory-100/80">{y.name}</span>
                    <span className="shrink-0 text-lg text-gold-400">{y.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    });
  }

  if (data.upcomingEvents.length > 0) {
    panels.push({
      key: 'events',
      title: 'Coming up',
      titleHe: 'אירועים',
      render: () => (
        <ul className="space-y-4">
          {data.upcomingEvents.map((e, i) => (
            <li key={i} className="border-b border-gold-700/20 pb-4 last:border-0">
              <p className="font-display text-4xl font-semibold text-ivory-50">{e.title}</p>
              <p className="mt-1 text-2xl text-gold-300">
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
