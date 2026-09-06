import 'server-only';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { sponsorships, yahrzeits, users, events } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getDaySchedule, getUpNext, getLiveAnnouncements } from '@/lib/schedule';
import { todayISO, addDaysISO, yahrzeitInYear, fmtDate } from '@/lib/zmanim';
import { HDate } from '@hebcal/core';

/** Everything the shul monitor needs, in one plain-JSON shape it can re-poll. */
export interface DisplayData {
  generatedAt: number;
  timezone: string;
  shul: { nameHe: string; nameEn: string; dedicationHe: string; nasiHe: string };
  rotateSeconds: number;
  standingMessage: string;
  today: {
    iso: string;
    civil: string;
    hebrewHe: string;
    hebrewEn: string;
    parshaHe: string | null;
    parshaEn: string | null;
    holidays: string[];
    omer: number | null;
    dafYomi: string | null;
    dafYomiHe: string | null;
    isShabbos: boolean;
  };
  zmanim: { id: string; label: string; labelHe: string; at: number | null }[];
  upNext: { name: string; nameHe: string | null; at: number; location: string | null; iso: string }[];
  minyanimToday: { name: string; nameHe: string | null; at: number | null; location: string | null }[];
  shiurimToday: { title: string; titleHe: string | null; maggidShiur: string | null; at: number | null; location: string | null }[];
  announcements: { title: string; body: string; priority: string }[];
  sponsors: { kind: string; date: string; dateLabel: string; sponsorName: string; occasion: string }[];
  yahrzeitsToday: { name: string; nameHe: string; hebrewDate: string; forFamily: string }[];
  yahrzeitsSoon: { name: string; nameHe: string; when: string; forFamily: string }[];
  upcomingEvents: { title: string; when: string; location: string }[];
  showYahrzeits: boolean;
  showSponsors: boolean;
  showDaf: boolean;
}

/** Zmanim worth putting on a wall, in the order a person scans them. */
const BOARD_ZMANIM = [
  'alos', 'sunrise', 'sofZmanShmaGRA', 'sofZmanTfilaGRA',
  'chatzos', 'minchaGedola', 'plag', 'candleLighting', 'sunset', 'tzais',
];

export async function getDisplayData(): Promise<DisplayData> {
  const settings = await getSettings();
  const tz = settings.timezone;
  const iso = todayISO(tz);
  const thisHebrewYear = new HDate().yy;

  const [schedule, upNext, news, sponsorRows, yahrzeitRows, eventRows] = await Promise.all([
    getDaySchedule(iso, settings),
    getUpNext(settings, 3),
    getLiveAnnouncements({ audience: 'public', displayOnly: true, limit: 6 }),
    db
      .select()
      .from(sponsorships)
      .where(and(gte(sponsorships.date, iso), eq(sponsorships.status, 'confirmed')))
      .orderBy(asc(sponsorships.date))
      .limit(6),
    db
      .select({ y: yahrzeits, firstName: users.firstName, lastName: users.lastName })
      .from(yahrzeits)
      .leftJoin(users, eq(yahrzeits.userId, users.id))
      .where(eq(yahrzeits.showOnDisplay, true)),
    db
      .select()
      .from(events)
      .where(and(gte(events.startAt, Math.floor(Date.now() / 1000)), eq(events.showOnDisplay, true)))
      .orderBy(asc(events.startAt))
      .limit(5),
  ]);

  const { info } = schedule.day;

  // Yahrzeits are stored by Hebrew date, so resolve each into this year's civil
  // date and split into "today" and "the week ahead".
  const inSevenDays = addDaysISO(iso, 7, tz);
  const yahrzeitsToday: DisplayData['yahrzeitsToday'] = [];
  const yahrzeitsSoon: DisplayData['yahrzeitsSoon'] = [];

  for (const { y, firstName, lastName } of yahrzeitRows) {
    for (const year of [thisHebrewYear, thisHebrewYear + 1]) {
      const when = DateTime.fromJSDate(yahrzeitInYear(y.hebrewDay, y.hebrewMonth, year)).toISODate()!;
      if (when < iso) continue;

      const entry = {
        name: y.nifterName,
        nameHe: y.nifterNameHe ?? '',
        forFamily: firstName ? `${firstName} ${lastName}` : '',
      };

      if (when === iso) {
        yahrzeitsToday.push({ ...entry, hebrewDate: info.hebrewDate });
      } else if (when <= inSevenDays) {
        yahrzeitsSoon.push({ ...entry, when: fmtDate(when, tz, 'ccc, LLL d') });
      }
      break; // only the next occurrence matters
    }
  }

  return {
    generatedAt: Date.now(),
    timezone: tz,
    shul: {
      nameHe: settings.nameHe,
      nameEn: settings.nameEn,
      dedicationHe: settings.dedicationHe,
      nasiHe: settings.nasiHe,
    },
    rotateSeconds: settings.displayRotateSeconds,
    standingMessage: settings.displayMessage ?? '',
    today: {
      iso,
      civil: fmtDate(iso, tz, 'cccc, LLLL d, yyyy'),
      hebrewHe: info.hebrewDateHe,
      hebrewEn: info.hebrewDate,
      parshaHe: info.parshaHe,
      parshaEn: info.parsha,
      holidays: info.holidays.map((h) => h.en),
      omer: info.omer,
      dafYomi: info.dafYomi,
      dafYomiHe: info.dafYomiHe,
      isShabbos: info.isShabbos,
    },
    zmanim: schedule.day.zmanim
      .filter((z) => BOARD_ZMANIM.includes(z.id) && z.at != null)
      .map((z) => ({ id: z.id, label: z.label, labelHe: z.labelHe, at: z.at })),
    upNext: upNext
      .filter((m) => m.at != null)
      .map((m) => ({ name: m.name, nameHe: m.nameHe, at: m.at!, location: m.location, iso: m.iso })),
    minyanimToday: schedule.minyanim
      .filter((m) => m.showOnDisplay)
      .map((m) => ({ name: m.name, nameHe: m.nameHe, at: m.at, location: m.location })),
    shiurimToday: schedule.shiurim
      .filter((s) => s.showOnDisplay)
      .map((s) => ({ title: s.title, titleHe: s.titleHe, maggidShiur: s.maggidShiur, at: s.at, location: s.location })),
    announcements: news.map((a) => ({ title: a.title, body: a.body ?? '', priority: a.priority })),
    sponsors: sponsorRows.map((s) => ({
      kind: s.kind.replace(/_/g, ' '),
      date: s.date,
      dateLabel: fmtDate(s.date, tz, 'ccc, LLL d'),
      sponsorName: s.sponsorName ?? '',
      occasion: s.occasion ?? '',
    })),
    yahrzeitsToday,
    yahrzeitsSoon: yahrzeitsSoon.slice(0, 8),
    upcomingEvents: eventRows.map((e) => ({
      title: e.title,
      when: DateTime.fromSeconds(e.startAt, { zone: tz }).toFormat('ccc, LLL d · h:mm a'),
      location: e.location ?? '',
    })),
    showYahrzeits: settings.displayShowYahrzeits,
    showSponsors: settings.displayShowSponsors,
    showDaf: settings.displayShowDaf,
  };
}
