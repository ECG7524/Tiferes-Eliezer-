import 'server-only';
import { eq, and, asc, or, isNull, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { minyanim, shiurim, announcements, type Settings, type Minyan, type Shiur } from '@/db/schema';
import {
  computeZmanim, dayTypesFor, resolveTime, todayISO, addDaysISO,
  type ZmanimDay,
} from '@/lib/zmanim';

export interface ResolvedMinyan {
  id: number;
  name: string;
  nameHe: string | null;
  location: string | null;
  notes: string | null;
  dayType: string;
  at: number | null;
  /** How the time was arrived at, e.g. "20 min before shkia". */
  rule: string | null;
  showOnDisplay: boolean;
}

export interface ResolvedShiur {
  id: number;
  title: string;
  titleHe: string | null;
  maggidShiur: string | null;
  location: string | null;
  description: string | null;
  at: number | null;
  durationMinutes: number;
  rule: string | null;
  showOnDisplay: boolean;
}

export interface DaySchedule {
  iso: string;
  day: ZmanimDay;
  minyanim: ResolvedMinyan[];
  shiurim: ResolvedShiur[];
}

function ruleText(
  timeType: string,
  relativeTo: string | null,
  offsetMinutes: number,
  roundTo: number,
): string | null {
  if (timeType !== 'relative') return null;
  const anchor = ANCHOR_TEXT[relativeTo ?? 'sunset'] ?? relativeTo ?? '';
  const mins = Math.abs(offsetMinutes);
  const base =
    offsetMinutes === 0
      ? `at ${anchor}`
      : `${mins} min ${offsetMinutes < 0 ? 'before' : 'after'} ${anchor}`;
  return roundTo > 0 ? `${base}, to the ${roundTo} min` : base;
}

const ANCHOR_TEXT: Record<string, string> = {
  alos: 'alos',
  sunrise: 'neitz',
  sof_zman_shma: 'sof zman shma',
  chatzos: 'chatzos',
  mincha_gedola: 'mincha gedola',
  plag: 'plag',
  candle_lighting: 'candle lighting',
  sunset: 'shkia',
  tzais: 'tzais',
};

/** Everything that happens in the shul on one civil date, with times resolved. */
export async function getDaySchedule(iso: string, settings: Settings): Promise<DaySchedule> {
  const day = computeZmanim(iso, settings);
  const types = dayTypesFor(day.info);
  const dow = day.info.dayOfWeek;

  const [allMinyanim, allShiurim] = await Promise.all([
    db.select().from(minyanim).where(eq(minyanim.active, true)).orderBy(asc(minyanim.sortOrder), asc(minyanim.name)),
    db.select().from(shiurim).where(eq(shiurim.active, true)).orderBy(asc(shiurim.sortOrder), asc(shiurim.title)),
  ]);

  const resolvedMinyanim: ResolvedMinyan[] = allMinyanim
    .filter((m) => types.has(m.dayType))
    .map((m: Minyan) => ({
      id: m.id,
      name: m.name,
      nameHe: m.nameHe,
      location: m.location,
      notes: m.notes,
      dayType: m.dayType,
      showOnDisplay: m.showOnDisplay,
      at: resolveTime(
        {
          timeType: m.timeType,
          fixedTime: m.fixedTime,
          relativeTo: m.relativeTo,
          offsetMinutes: m.offsetMinutes,
          roundTo: m.roundTo,
          roundDirection: m.roundDirection,
        },
        day, iso, settings.timezone,
      ),
      rule: ruleText(m.timeType, m.relativeTo, m.offsetMinutes, m.roundTo),
    }))
    .sort(byTime);

  const resolvedShiurim: ResolvedShiur[] = allShiurim
    .filter((s) => {
      if (s.recurrence === 'daily') return true;
      if (s.recurrence === 'weekly') return s.dayOfWeek === dow;
      if (s.recurrence === 'once') return s.specificDate === iso;
      if (s.recurrence === 'monthly') return s.specificDate === iso;
      return false;
    })
    .map((s: Shiur) => ({
      id: s.id,
      title: s.title,
      titleHe: s.titleHe,
      maggidShiur: s.maggidShiur,
      location: s.location,
      description: s.description,
      durationMinutes: s.durationMinutes,
      showOnDisplay: s.showOnDisplay,
      at: resolveTime(
        {
          timeType: s.timeType,
          fixedTime: s.startTime,
          relativeTo: s.relativeTo,
          offsetMinutes: s.offsetMinutes,
          roundTo: 0,
        },
        day, iso, settings.timezone,
      ),
      rule: ruleText(s.timeType, s.relativeTo, s.offsetMinutes, 0),
    }))
    .sort(byTime);

  return { iso, day, minyanim: resolvedMinyanim, shiurim: resolvedShiurim };
}

function byTime(a: { at: number | null }, b: { at: number | null }) {
  if (a.at == null) return 1;
  if (b.at == null) return -1;
  return a.at - b.at;
}

/**
 * The next few things starting, rolling over into tomorrow once the day's
 * minyanim have all gone. This is what the board leads with.
 */
export async function getUpNext(
  settings: Settings,
  limit = 4,
  nowMs = Date.now(),
): Promise<(ResolvedMinyan & { iso: string })[]> {
  const today = todayISO(settings.timezone);
  const out: (ResolvedMinyan & { iso: string })[] = [];

  for (let offset = 0; offset < 3 && out.length < limit; offset++) {
    const iso = offset === 0 ? today : addDaysISO(today, offset, settings.timezone);
    const { minyanim: mins } = await getDaySchedule(iso, settings);
    for (const m of mins) {
      if (m.at != null && m.at >= nowMs) out.push({ ...m, iso });
      if (out.length >= limit) break;
    }
  }

  return out;
}

/** Announcements that are live right now, newest and most urgent first. */
export async function getLiveAnnouncements(opts: {
  audience: 'public' | 'members';
  displayOnly?: boolean;
  limit?: number;
}) {
  const now = Math.floor(Date.now() / 1000);

  const audienceFilter =
    opts.audience === 'members'
      ? undefined // members see everything
      : eq(announcements.audience, 'public');

  const conditions = [
    lte(announcements.publishAt, now),
    or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
    ...(audienceFilter ? [audienceFilter] : []),
    ...(opts.displayOnly ? [eq(announcements.showOnDisplay, true)] : []),
  ];

  return db
    .select()
    .from(announcements)
    .where(and(...conditions))
    .orderBy(
      desc(announcements.pinned),
      // urgent, then high, then normal
      sql`case ${announcements.priority} when 'urgent' then 0 when 'high' then 1 else 2 end`,
      desc(announcements.publishAt),
    )
    .limit(opts.limit ?? 50);
}
