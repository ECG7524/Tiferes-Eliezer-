import { GeoLocation, ComplexZmanimCalendar, JewishCalendar, HebrewDateFormatter, YomiCalculator } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { HDate, HebrewCalendar, gematriya } from '@hebcal/core';
import type { Settings } from '@/db/schema';

export type ZmanId =
  | 'alos' | 'misheyakir' | 'sunrise' | 'sofZmanShmaMGA' | 'sofZmanShmaGRA'
  | 'sofZmanTfilaMGA' | 'sofZmanTfilaGRA' | 'chatzos' | 'minchaGedola' | 'minchaKetana'
  | 'plag' | 'candleLighting' | 'sunset' | 'tzais' | 'tzais72' | 'chatzosHalayla'
  | 'shaahZmanisGRA' | 'shaahZmanisMGA';

export interface Zman {
  id: ZmanId;
  label: string;
  labelHe: string;
  /** Milliseconds since epoch, or null when the opinion has no time that day. */
  at: number | null;
  /** Durations (the shaos zmanios) are shown as "62 min", not as a clock time. */
  isDuration?: boolean;
  minutes?: number;
  note?: string;
}

export interface DayInfo {
  iso: string;
  hebrewDate: string;
  hebrewDateHe: string;
  hebrewYearHe: string;
  dayOfWeek: number;
  parsha: string | null;
  parshaHe: string | null;
  holidays: { en: string; he: string; category: string }[];
  omer: number | null;
  dafYomi: string | null;
  dafYomiHe: string | null;
  isShabbos: boolean;
  isYomTov: boolean;
  isCholHamoed: boolean;
  isRoshChodesh: boolean;
  isFastDay: boolean;
  isChanukah: boolean;
  /** True on Shabbos and Yom Tov — the days when melacha is forbidden. */
  isAssurBemelacha: boolean;
  isErevShabbos: boolean;
  isMotzeiShabbos: boolean;
}

export interface ZmanimDay {
  info: DayInfo;
  zmanim: Zman[];
  byId: Record<string, number | null>;
  timezone: string;
}

/* ------------------------------------------------------------------ */

function geo(s: Settings) {
  return new GeoLocation(s.city, s.latitude, s.longitude, s.elevation, s.timezone);
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  const anyV = v as { toMillis?: () => number; valueOf?: () => number };
  if (typeof anyV.toMillis === 'function') return anyV.toMillis();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A handful of getters default their day boundaries at runtime but only publish
 * the explicit three-argument overload in their types. Reaching them through
 * this alias keeps the library's own defaults instead of us guessing at them.
 */
interface DefaultedZmanim {
  getMinchaKetana(): unknown;
  getPlagHamincha(): unknown;
}

function defaulted(cal: ComplexZmanimCalendar): DefaultedZmanim {
  return cal as unknown as DefaultedZmanim;
}

/** Runs a calendar getter and swallows the "no such time at this latitude" case. */
function safe(fn: () => unknown): number | null {
  try {
    return toMillis(fn());
  } catch {
    return null;
  }
}

function alosFor(cal: ComplexZmanimCalendar, opinion: string): number | null {
  switch (opinion) {
    case 'minutes_72': return safe(() => cal.getAlos72());
    case 'minutes_90': return safe(() => cal.getAlos90());
    case 'minutes_120': return safe(() => cal.getAlos120());
    case 'baal_hatanya': return safe(() => cal.getAlosBaalHatanya());
    case 'degrees_16_1':
    default: return safe(() => cal.getAlos16Point1Degrees());
  }
}

function tzaisFor(cal: ComplexZmanimCalendar, opinion: string): number | null {
  switch (opinion) {
    case 'minutes_50': return safe(() => cal.getTzais50());
    case 'minutes_60': return safe(() => cal.getTzais60());
    case 'minutes_72': return safe(() => cal.getTzais72());
    case 'degrees_16_1': return safe(() => cal.getTzais16Point1Degrees());
    case 'baal_hatanya': return safe(() => cal.getTzaisBaalHatanya());
    case 'geonim_8_5':
    default: return safe(() => cal.getTzaisGeonim8Point5Degrees());
  }
}

export const ALOS_OPINION_LABELS: Record<string, string> = {
  degrees_16_1: '16.1° below the horizon',
  minutes_72: '72 minutes before sunrise',
  minutes_90: '90 minutes before sunrise',
  minutes_120: '120 minutes before sunrise',
  baal_hatanya: "Baal HaTanya",
};

export const TZAIS_OPINION_LABELS: Record<string, string> = {
  geonim_8_5: 'Geonim — 8.5° below the horizon',
  minutes_50: '50 minutes after sunset',
  minutes_60: '60 minutes after sunset',
  minutes_72: '72 minutes (Rabbeinu Tam)',
  degrees_16_1: '16.1° (Rabbeinu Tam)',
  baal_hatanya: 'Baal HaTanya',
};

/* ------------------------------------------------------------------ */
/* Hebrew calendar facts for a given civil date                        */
/* ------------------------------------------------------------------ */

export function getDayInfo(iso: string, s: Settings): DayInfo {
  const dt = DateTime.fromISO(iso, { zone: s.timezone });
  const hd = new HDate(new Date(dt.year, dt.month - 1, dt.day));

  const events = HebrewCalendar.calendar({
    start: hd,
    end: hd,
    il: s.inIsrael,
    sedrot: true,
    omer: true,
    candlelighting: false,
    noMinorFast: false,
    noSpecialShabbat: false,
  });

  let parsha: string | null = null;
  let parshaHe: string | null = null;
  const holidays: { en: string; he: string; category: string }[] = [];
  let omer: number | null = null;

  for (const ev of events) {
    const cats = ev.getCategories();
    if (cats.includes('parashat')) {
      parsha = ev.render('en').replace(/^Parashat\s+/, '');
      parshaHe = ev.render('he');
    } else if (cats.includes('omer')) {
      omer = (ev as unknown as { omer?: number }).omer ?? null;
    } else {
      holidays.push({ en: ev.render('en'), he: ev.render('he'), category: cats[0] ?? 'holiday' });
    }
  }

  // The parsha of the coming Shabbos, for days that aren't Shabbos themselves.
  if (!parsha) {
    const daysToShabbos = (6 - dt.weekday % 7 + 7) % 7;
    const shabbos = hd.add(daysToShabbos === 0 ? 0 : daysToShabbos, 'd');
    const sedra = HebrewCalendar.calendar({ start: shabbos, end: shabbos, il: s.inIsrael, sedrot: true })
      .find((e) => e.getCategories().includes('parashat'));
    if (sedra) {
      parsha = sedra.render('en').replace(/^Parashat\s+/, '');
      parshaHe = sedra.render('he');
    }
  }

  // kosher-zmanim's JewishCalendar gives us the halachic day-type flags and daf.
  const jc = new JewishCalendar(hd.yy, hd.mm, hd.dd);
  jc.setInIsrael(s.inIsrael);

  let dafYomi: string | null = null;
  let dafYomiHe: string | null = null;
  try {
    // Must go through YomiCalculator: JewishCalendar's own accessor is stubbed
    // out in this port to avoid a circular import.
    const daf = YomiCalculator.getDafYomiBavli(jc);
    if (daf) {
      dafYomi = `${daf.getMasechtaTransliterated()} ${daf.getDaf()}`;
      const fmt = new HebrewDateFormatter();
      fmt.setHebrewFormat(true);
      try {
        dafYomiHe = fmt.formatDafYomiBavli(daf);
      } catch {
        dafYomiHe = dafYomi;
      }
    }
  } catch { /* Daf Yomi only starts in 1923; earlier dates simply have none. */ }

  const dow = dt.weekday % 7; // Luxon: Mon=1..Sun=7  ->  Sun=0..Sat=6
  const isShabbos = dow === 6;

  return {
    iso,
    hebrewDate: hd.render('en'),
    hebrewDateHe: hd.render('he'),
    hebrewYearHe: gematriya(hd.yy),
    dayOfWeek: dow,
    parsha,
    parshaHe,
    holidays,
    omer,
    dafYomi,
    dafYomiHe,
    isShabbos,
    isYomTov: safeBool(() => jc.isYomTov()),
    isCholHamoed: safeBool(() => jc.isCholHamoed()),
    isRoshChodesh: safeBool(() => jc.isRoshChodesh()),
    isFastDay: safeBool(() => jc.isTaanis()),
    isChanukah: safeBool(() => jc.isChanukah()),
    isAssurBemelacha: isShabbos || safeBool(() => jc.isYomTovAssurBemelacha()),
    isErevShabbos: dow === 5,
    isMotzeiShabbos: dow === 6,
  };
}

function safeBool(fn: () => boolean): boolean {
  try { return !!fn(); } catch { return false; }
}

/* ------------------------------------------------------------------ */
/* The zmanim themselves                                               */
/* ------------------------------------------------------------------ */

export function computeZmanim(iso: string, s: Settings): ZmanimDay {
  const info = getDayInfo(iso, s);
  const cal = new ComplexZmanimCalendar(geo(s));
  cal.setDate(DateTime.fromISO(iso, { zone: s.timezone }));
  cal.setCandleLightingOffset(s.candleLightingMinutes);

  const alos = alosFor(cal, s.alosOpinion);
  const tzais = tzaisFor(cal, s.tzaisOpinion);
  const sunset = safe(() => cal.getSunset());

  // Candle lighting is only a real answer on Erev Shabbos or Erev Yom Tov.
  const lightsCandles = info.isErevShabbos || isErevYomTov(iso, s);
  const candle = lightsCandles ? safe(() => cal.getCandleLighting()) : null;

  const shaahGra = safe(() => cal.getShaahZmanisGra());
  const shaahMga = safe(() => cal.getShaahZmanis72Minutes());

  const zmanim: Zman[] = [
    { id: 'alos', label: 'Alos Hashachar', labelHe: 'עלות השחר', at: alos, note: ALOS_OPINION_LABELS[s.alosOpinion] },
    { id: 'misheyakir', label: 'Earliest Tallis & Tefillin', labelHe: 'משיכיר', at: safe(() => cal.getMisheyakir10Point2Degrees()) },
    { id: 'sunrise', label: 'Neitz Hachama', labelHe: 'נץ החמה', at: safe(() => cal.getSunrise()) },
    { id: 'sofZmanShmaMGA', label: 'Sof Zman Krias Shma (MG"A)', labelHe: 'סוף זמן ק"ש מג"א', at: safe(() => cal.getSofZmanShmaMGA()) },
    { id: 'sofZmanShmaGRA', label: 'Sof Zman Krias Shma (Gr"a)', labelHe: 'סוף זמן ק"ש גר"א', at: safe(() => cal.getSofZmanShmaGRA()) },
    { id: 'sofZmanTfilaMGA', label: 'Sof Zman Tefilla (MG"A)', labelHe: 'סוף זמן תפילה מג"א', at: safe(() => cal.getSofZmanTfilaMGA()) },
    { id: 'sofZmanTfilaGRA', label: 'Sof Zman Tefilla (Gr"a)', labelHe: 'סוף זמן תפילה גר"א', at: safe(() => cal.getSofZmanTfilaGRA()) },
    { id: 'chatzos', label: 'Chatzos', labelHe: 'חצות היום', at: safe(() => cal.getChatzos()) },
    { id: 'minchaGedola', label: 'Mincha Gedola', labelHe: 'מנחה גדולה', at: safe(() => cal.getMinchaGedola()) },
    { id: 'minchaKetana', label: 'Mincha Ketana', labelHe: 'מנחה קטנה', at: safe(() => defaulted(cal).getMinchaKetana()) },
    { id: 'plag', label: 'Plag Hamincha', labelHe: 'פלג המנחה', at: safe(() => defaulted(cal).getPlagHamincha()) },
    ...(candle ? [{ id: 'candleLighting' as ZmanId, label: 'Candle Lighting', labelHe: 'הדלקת נרות', at: candle, note: `${s.candleLightingMinutes} minutes before shkia` }] : []),
    { id: 'sunset', label: 'Shkias Hachama', labelHe: 'שקיעת החמה', at: sunset },
    { id: 'tzais', label: 'Tzais Hakochavim', labelHe: 'צאת הכוכבים', at: tzais, note: TZAIS_OPINION_LABELS[s.tzaisOpinion] },
    { id: 'tzais72', label: 'Tzais (Rabbeinu Tam)', labelHe: 'צאת ר"ת', at: safe(() => cal.getTzais72()) },
    { id: 'chatzosHalayla', label: 'Chatzos Halayla', labelHe: 'חצות הלילה', at: safe(() => cal.getSolarMidnight()) },
    { id: 'shaahZmanisGRA', label: 'Shaah Zmanis (Gr"a)', labelHe: 'שעה זמנית גר"א', at: null, isDuration: true, minutes: shaahGra ? Math.round(shaahGra / 60000) : undefined },
    { id: 'shaahZmanisMGA', label: 'Shaah Zmanis (MG"A)', labelHe: 'שעה זמנית מג"א', at: null, isDuration: true, minutes: shaahMga ? Math.round(shaahMga / 60000) : undefined },
  ];

  const byId: Record<string, number | null> = {};
  for (const z of zmanim) byId[z.id] = z.at;

  return { info, zmanim, byId, timezone: s.timezone };
}

/** Erev Yom Tov means candles get lit even though it isn't Friday. */
function isErevYomTov(iso: string, s: Settings): boolean {
  const dt = DateTime.fromISO(iso, { zone: s.timezone }).plus({ days: 1 });
  const hd = new HDate(new Date(dt.year, dt.month - 1, dt.day));
  const jc = new JewishCalendar(hd.yy, hd.mm, hd.dd);
  jc.setInIsrael(s.inIsrael);
  return safeBool(() => jc.isYomTovAssurBemelacha());
}

/* ------------------------------------------------------------------ */
/* Turning a schedule row into an actual clock time                    */
/* ------------------------------------------------------------------ */

const ANCHORS: Record<string, ZmanId> = {
  alos: 'alos',
  sunrise: 'sunrise',
  sof_zman_shma: 'sofZmanShmaGRA',
  chatzos: 'chatzos',
  mincha_gedola: 'minchaGedola',
  plag: 'plag',
  candle_lighting: 'candleLighting',
  sunset: 'sunset',
  tzais: 'tzais',
};

export const ANCHOR_LABELS: Record<string, string> = {
  alos: 'Alos',
  sunrise: 'Neitz',
  sof_zman_shma: 'Sof Zman Shma',
  chatzos: 'Chatzos',
  mincha_gedola: 'Mincha Gedola',
  plag: 'Plag Hamincha',
  candle_lighting: 'Candle Lighting',
  sunset: 'Shkia',
  tzais: 'Tzais',
};

export interface ScheduleTiming {
  timeType: 'fixed' | 'relative';
  fixedTime?: string | null;
  relativeTo?: string | null;
  offsetMinutes?: number | null;
  roundTo?: number | null;
  roundDirection?: 'nearest' | 'earlier' | 'later' | null;
}

/**
 * Resolves a minyan or shiur to a millisecond timestamp on a given day.
 * A fixed time is read straight off the clock; a relative one floats with the
 * zman it hangs off, optionally rounded to a tidy figure the way a printed
 * luach does it ("Mincha 20 minutes before shkia, rounded down to the 5").
 */
export function resolveTime(t: ScheduleTiming, day: ZmanimDay, iso: string, tz: string): number | null {
  if (t.timeType === 'fixed') {
    const hhmm = (t.fixedTime || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!m) return null;
    const dt = DateTime.fromISO(iso, { zone: tz }).set({
      hour: Number(m[1]), minute: Number(m[2]), second: 0, millisecond: 0,
    });
    return dt.toMillis();
  }

  const anchorId = ANCHORS[t.relativeTo || 'sunset'];
  const base = day.byId[anchorId];
  if (base == null) return null;

  let ms = base + (t.offsetMinutes ?? 0) * 60000;

  const roundTo = t.roundTo ?? 0;
  if (roundTo > 0) {
    const step = roundTo * 60000;
    const dt = DateTime.fromMillis(ms, { zone: tz }).set({ second: 0, millisecond: 0 });
    const midnight = dt.startOf('day').toMillis();
    const since = dt.toMillis() - midnight;
    const dir = t.roundDirection ?? 'earlier';
    const rounded =
      dir === 'earlier' ? Math.floor(since / step) * step
      : dir === 'later' ? Math.ceil(since / step) * step
      : Math.round(since / step) * step;
    ms = midnight + rounded;
  } else {
    ms = DateTime.fromMillis(ms, { zone: tz }).set({ second: 0, millisecond: 0 }).toMillis();
  }

  return ms;
}

/**
 * Which schedule day-types apply to this date. A single date can match several
 * — Friday is both `friday` and `erev_shabbos` — so callers filter on the set.
 */
export function dayTypesFor(info: DayInfo): Set<string> {
  const out = new Set<string>();
  const dow = info.dayOfWeek;

  // Yom Tov can land on Shabbos, and then both schedules are in play.
  const isYomTovDay = info.isYomTov && info.isAssurBemelacha;
  if (isYomTovDay) out.add('yom_tov');

  if (info.isShabbos) {
    out.add('shabbos');
    // Motzei Shabbos is Saturday night, which is still the same civil date.
    out.add('motzei_shabbos');
  } else if (!isYomTovDay) {
    if (dow === 0) out.add('sunday');
    if (dow >= 1 && dow <= 5) out.add('weekday');
    if (dow === 1 || dow === 4) out.add('monday_thursday');
    if (dow === 5) { out.add('friday'); out.add('erev_shabbos'); }
  }

  if (info.isRoshChodesh) out.add('rosh_chodesh');
  if (info.isFastDay) out.add('fast_day');

  return out;
}

export const DAY_TYPE_LABELS: Record<string, string> = {
  weekday: 'Weekdays (Mon–Fri)',
  monday_thursday: 'Monday & Thursday',
  sunday: 'Sunday',
  friday: 'Friday',
  erev_shabbos: 'Erev Shabbos',
  shabbos: 'Shabbos',
  motzei_shabbos: 'Motzei Shabbos',
  yom_tov: 'Yom Tov',
  rosh_chodesh: 'Rosh Chodesh',
  fast_day: 'Fast Days',
};

/* ------------------------------------------------------------------ */
/* Yahrzeits                                                           */
/* ------------------------------------------------------------------ */

/** The civil date a yahrzeit falls on in a given Hebrew year. */
export function yahrzeitInYear(hebrewDay: number, hebrewMonth: number, hebrewYear: number): Date {
  // Hebcal normalises impossible dates (30 Cheshvan in a short year) for us.
  return new HDate(hebrewDay, hebrewMonth, hebrewYear).greg();
}

export function hebrewMonthName(month: number, year: number): string {
  return new HDate(1, month, year).render('en').replace(/^\d+\w*\s+of\s+/, '').replace(/,.*$/, '');
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function fmtTime(ms: number | null | undefined, tz: string, opts: { seconds?: boolean } = {}): string {
  if (ms == null) return '—';
  return DateTime.fromMillis(ms, { zone: tz }).toFormat(opts.seconds ? 'h:mm:ss a' : 'h:mm a');
}

export function fmtDate(iso: string, tz: string, fmt = 'cccc, LLLL d, yyyy'): string {
  return DateTime.fromISO(iso, { zone: tz }).toFormat(fmt);
}

export function todayISO(tz: string): string {
  return DateTime.now().setZone(tz).toISODate()!;
}

export function addDaysISO(iso: string, days: number, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz }).plus({ days }).toISODate()!;
}
