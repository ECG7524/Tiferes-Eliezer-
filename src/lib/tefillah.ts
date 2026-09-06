import { HDate, Molad, months, HebrewCalendar } from '@hebcal/core';
import { DateTime } from 'luxon';

/**
 * What changes in davening today — the lines a board exists to remind people
 * about. Everything here is derived from the Hebrew date; nothing is stored.
 *
 * Where opinions or minhagim differ the shul's choice comes in through
 * `TefillahOptions` rather than being decided here.
 */

export interface TefillahOptions {
  inIsrael: boolean;
  /** Nusach Sefard and Eretz Yisrael say מוריד הטל through the summer; Ashkenaz says nothing. */
  saysMoridHatal: boolean;
  /** Rema is 7 days after the molad; much of Chassidus says 3. */
  kiddushLevanaFromDays: number;
  timezone: string;
}

export interface Insertion {
  /** A short tag so the board can group or colour them. */
  key: string;
  he: string;
  en: string;
  note?: string;
  noteEn?: string;
}

export interface TachanunStatus {
  said: boolean;
  /** True when it is said in the morning but dropped at Mincha. */
  minchaOmitted: boolean;
  he: string;
  reasonHe?: string;
}

export interface KiddushLevanaWindow {
  fromISO: string;
  untilISO: string;
  fromLabelHe: string;
  untilLabelHe: string;
  /** Whether tonight falls inside the window. */
  openTonight: boolean;
}

export interface TefillahDay {
  insertions: Insertion[];
  tachanun: TachanunStatus;
  hallel: { he: string; en: string } | null;
  kiddushLevana: KiddushLevanaWindow | null;
  /** Set only on Shabbos Mevorchim. */
  molad: { he: string; en: string; monthHe: string } | null;
}

/* ------------------------------------------------------------------ */
/* Small helpers over the Hebrew date                                  */
/* ------------------------------------------------------------------ */

/**
 * The civil day a Hebrew date falls on, in the shul's zone. Built from the
 * date parts rather than by converting `greg()` — that is midnight in whatever
 * zone the server happens to run in, and shifting the instant can land a day
 * out.
 */
function civilDay(hd: HDate, timezone: string): DateTime {
  const g = hd.greg();
  return DateTime.fromObject(
    { year: g.getFullYear(), month: g.getMonth() + 1, day: g.getDate() },
    { zone: timezone },
  );
}

const MONTH_HE: Record<number, string> = {
  [months.NISAN]: 'ניסן',
  [months.IYYAR]: 'אייר',
  [months.SIVAN]: 'סיון',
  [months.TAMUZ]: 'תמוז',
  [months.AV]: 'אב',
  [months.ELUL]: 'אלול',
  [months.TISHREI]: 'תשרי',
  [months.CHESHVAN]: 'חשון',
  [months.KISLEV]: 'כסלו',
  [months.TEVET]: 'טבת',
  [months.SHVAT]: 'שבט',
  [months.ADAR_I]: 'אדר א׳',
  [months.ADAR_II]: 'אדר ב׳',
};

function holidayKeys(hd: HDate, inIsrael: boolean): Set<string> {
  const out = new Set<string>();
  for (const ev of HebrewCalendar.getHolidaysOnDate(hd, inIsrael) ?? []) {
    out.add(ev.getDesc());
  }
  return out;
}

function isRoshChodesh(hd: HDate): boolean {
  return hd.getDate() === 1 || hd.getDate() === 30;
}

/**
 * Which day of Chanukah this is, 1-8, counting by date rather than by candles.
 * hebcal's "Chanukah: 1 Candle" falls on 24 Kislev because it describes the
 * evening ahead, but al hanisim and Hallel belong to the day of 25 Kislev on.
 */
function chanukahDay(hd: HDate): number | null {
  const m = hd.getMonth();
  if (m !== months.KISLEV && m !== months.TEVET) return null;
  // Kislev and Teves fall in the same Hebrew year, so 25 Kislev anchors both.
  const day = hd.abs() - new HDate(25, months.KISLEV, hd.getFullYear()).abs() + 1;
  return day >= 1 && day <= 8 ? day : null;
}


/* ------------------------------------------------------------------ */
/* Rain and dew                                                        */
/* ------------------------------------------------------------------ */

/**
 * משיב הרוח ומוריד הגשם runs from Musaf of Shemini Atzeres (22 Tishrei) to
 * Musaf of the first day of Pesach (15 Nisan).
 */
function inGeshemSeason(hd: HDate): boolean {
  const m = hd.getMonth();
  const d = hd.getDate();

  // Tishrei: only from Shemini Atzeres onwards.
  if (m === months.TISHREI) return d >= 22;
  // Nisan: up to and including the first day of Pesach.
  if (m === months.NISAN) return d <= 15;
  // Cheshvan through Adar is entirely winter.
  return (
    m === months.CHESHVAN || m === months.KISLEV || m === months.TEVET ||
    m === months.SHVAT || m === months.ADAR_I || m === months.ADAR_II
  );
}

/**
 * The day ותן טל ומטר begins outside Eretz Yisrael: Maariv of 4 December,
 * or 5 December in the year before a civil leap year. (The rule tracks 60 days
 * from tekufas Tishrei; it shifts again after 2100, which this does not model.)
 */
export function talUmatarStartDate(gregorianYear: number): DateTime {
  const nextYearIsLeap = (gregorianYear + 1) % 4 === 0;
  return DateTime.fromObject({ year: gregorianYear, month: 12, day: nextYearIsLeap ? 5 : 4 });
}

/**
 * Whether ותן טל ומטר is said today rather than ותן ברכה. In Eretz Yisrael it
 * starts on 7 Cheshvan; everywhere else on the December date above. Both end
 * at Pesach.
 */
function saysTalUmatar(hd: HDate, inIsrael: boolean): boolean {
  const m = hd.getMonth();
  const d = hd.getDate();

  // Ends with the first day of Pesach.
  if (m === months.NISAN) return d < 15;
  if (m === months.IYYAR || m === months.SIVAN || m === months.TAMUZ || m === months.AV || m === months.ELUL) {
    return false;
  }
  // Tishrei is always before either start date.
  if (m === months.TISHREI) return false;

  if (inIsrael) {
    if (m === months.CHESHVAN) return d >= 7;
    return true; // Kislev through Adar
  }

  // Outside Eretz Yisrael the start is fixed to the civil calendar, so compare
  // the actual dates rather than the Hebrew month.
  const greg = DateTime.fromJSDate(hd.greg());
  const start = talUmatarStartDate(greg.month === 12 ? greg.year : greg.year - 1);
  return greg.startOf('day') >= start.startOf('day');
}

/* ------------------------------------------------------------------ */
/* Tachanun                                                            */
/* ------------------------------------------------------------------ */

/**
 * The days tachanun is not said. Where a day only drops it at Mincha — erev
 * Shabbos, erev Rosh Chodesh, erev Yom Tov — that is reported separately so
 * the board can say so rather than overstating it.
 */
function tachanunFor(hd: HDate, inIsrael: boolean): TachanunStatus {
  const m = hd.getMonth();
  const d = hd.getDate();
  const dow = hd.getDay();
  const keys = holidayKeys(hd, inIsrael);

  const no = (reasonHe: string): TachanunStatus => ({
    said: false, minchaOmitted: true, he: 'אין אומרים תחנון', reasonHe,
  });

  if (dow === 6) return no('שבת');
  if (isRoshChodesh(hd)) return no('ראש חודש');

  // Yom Tov and Chol Hamoed.
  for (const k of keys) {
    if (/Pesach|Sukkot|Shavuot|Rosh Hashana|Yom Kippur|Shmini Atzeret|Simchat Torah|Chol ha-Moed/i.test(k)) {
      return no(k);
    }
  }

  if (m === months.NISAN) return no('חודש ניסן');
  if (m === months.IYYAR && d === 14) return no('פסח שני');
  if (m === months.IYYAR && d === 18) return no('ל״ג בעומר');
  // Rosh Chodesh Sivan through 12 Sivan — Shavuos and its days of tashlumin.
  if (m === months.SIVAN && d <= 12) return no('ימי תשלומין');
  if (m === months.AV && (d === 9 || d === 15)) return no(d === 9 ? 'תשעה באב' : 'ט״ו באב');
  if (m === months.SHVAT && d === 15) return no('ט״ו בשבט');
  if ((m === months.ADAR_I || m === months.ADAR_II) && (d === 14 || d === 15)) {
    return no(m === months.ADAR_I ? 'פורים קטן' : 'פורים');
  }
  if (chanukahDay(hd) !== null) return no('חנוכה');
  // Erev Rosh Hashana through the end of Tishrei.
  if (m === months.ELUL && d === 29) return no('ערב ראש השנה');
  if (m === months.TISHREI) return no('חודש תשרי');

  // Said today, but dropped at Mincha on the eve of Shabbos, Rosh Chodesh or Yom Tov.
  const tomorrow = hd.add(1, 'd');
  const minchaOmitted =
    dow === 5 || isRoshChodesh(tomorrow) ||
    [...holidayKeys(tomorrow, inIsrael)].some((k) => /Erev|Pesach|Sukkot|Shavuot|Rosh Hashana|Yom Kippur/i.test(k));

  return {
    said: true,
    minchaOmitted,
    he: minchaOmitted ? 'אומרים תחנון · לא במנחה' : 'אומרים תחנון',
  };
}

/* ------------------------------------------------------------------ */
/* Hallel                                                              */
/* ------------------------------------------------------------------ */

function hallelFor(hd: HDate, inIsrael: boolean): { he: string; en: string } | null {
  const m = hd.getMonth();
  const d = hd.getDate();

  if (chanukahDay(hd) !== null) return { he: 'הלל שלם', en: 'Full Hallel' };

  if (m === months.TISHREI) {
    // Sukkos, Shmini Atzeres and Simchas Torah all take full Hallel.
    if (d >= 15 && d <= (inIsrael ? 22 : 23)) return { he: 'הלל שלם', en: 'Full Hallel' };
  }

  if (m === months.SIVAN && (d === 6 || (!inIsrael && d === 7))) {
    return { he: 'הלל שלם', en: 'Full Hallel' };
  }

  if (m === months.NISAN && d >= 15 && d <= (inIsrael ? 21 : 22)) {
    const fullDays = inIsrael ? [15] : [15, 16];
    return fullDays.includes(d)
      ? { he: 'הלל שלם', en: 'Full Hallel' }
      : { he: 'חצי הלל', en: 'Half Hallel' };
  }

  if (isRoshChodesh(hd)) return { he: 'חצי הלל', en: 'Half Hallel' };

  return null;
}

/* ------------------------------------------------------------------ */
/* Molad and kiddush levana                                            */
/* ------------------------------------------------------------------ */

/**
 * The molad as an actual moment. hebcal gives it as a day of the week plus a
 * time, so we pin the date by finding the day near Rosh Chodesh that falls on
 * that weekday. The clock time is Jerusalem's, which is how the molad is
 * announced, so it is converted to the shul's zone before being used for the
 * kiddush levana window.
 */
function moladMoment(year: number, month: number, timezone: string): DateTime | null {
  let molad: Molad;
  try {
    molad = new Molad(year, month);
  } catch {
    return null;
  }

  const roshChodesh = new HDate(1, month, year);
  const rcGreg = DateTime.fromJSDate(roshChodesh.greg());

  // The molad falls within a couple of days either side of Rosh Chodesh, and a
  // weekday is unique inside that span.
  for (let offset = -3; offset <= 2; offset++) {
    const candidate = rcGreg.plus({ days: offset });
    // Luxon: Mon=1..Sun=7. hebcal: Sun=0..Sat=6.
    if (candidate.weekday % 7 === molad.getDow()) {
      return DateTime.fromObject(
        {
          year: candidate.year, month: candidate.month, day: candidate.day,
          hour: molad.getHour(), minute: molad.getMinutes(),
        },
        { zone: 'Asia/Jerusalem' },
      ).setZone(timezone);
    }
  }
  return null;
}

/**
 * The window for kiddush levana: from the shul's chosen number of days after
 * the molad until halfway through the lunar month — 14 days, 18 hours and
 * 22 minutes after it.
 */
function kiddushLevanaFor(hd: HDate, opts: TefillahOptions): KiddushLevanaWindow | null {
  // Work from this month's molad, falling back to last month's near the start.
  for (const back of [0, 1]) {
    const ref = back === 0 ? hd : hd.subtract(15, 'd');
    const moment = moladMoment(ref.getFullYear(), ref.getMonth(), opts.timezone);
    if (!moment) continue;

    const from = moment.plus({ days: opts.kiddushLevanaFromDays });
    const until = moment.plus({ days: 14, hours: 18, minutes: 22 });

    const today = civilDay(hd, opts.timezone);
    if (today > until.startOf('day')) continue; // this month's window has closed

    return {
      fromISO: from.toISODate()!,
      untilISO: until.toISODate()!,
      fromLabelHe: from.setLocale('he').toFormat('d/M') + ' בלילה',
      untilLabelHe: until.setLocale('he').toFormat('d/M'),
      openTonight: today >= from.startOf('day') && today <= until.startOf('day'),
    };
  }
  return null;
}

/** Shabbos Mevorchim: the Shabbos before Rosh Chodesh, other than before Tishrei. */
function moladAnnouncement(hd: HDate, opts: TefillahOptions) {
  if (hd.getDay() !== 6) return null;

  // Which month are we about to bench?
  const nextRoshChodesh = findNextRoshChodesh(hd);
  if (!nextRoshChodesh) return null;
  if (nextRoshChodesh.getMonth() === months.TISHREI) return null; // Rosh Hashana is not benched

  let molad: Molad;
  try {
    molad = new Molad(nextRoshChodesh.getFullYear(), nextRoshChodesh.getMonth());
  } catch {
    return null;
  }

  return {
    he: molad.render('he', {}),
    en: molad.render('en', {}),
    monthHe: MONTH_HE[nextRoshChodesh.getMonth()] ?? '',
  };
}

/** The Rosh Chodesh in the week following this Shabbos, if there is one. */
function findNextRoshChodesh(shabbos: HDate): HDate | null {
  for (let i = 1; i <= 7; i++) {
    const day = shabbos.add(i, 'd');
    if (day.getDate() === 1) return day;
  }
  return null;
}

/* ------------------------------------------------------------------ */

export function getTefillahDay(hd: HDate, opts: TefillahOptions): TefillahDay {
  const insertions: Insertion[] = [];
  const keys = [...holidayKeys(hd, opts.inIsrael)];

  // --- Rain and dew, in the second bracha of shemoneh esrei ---
  if (inGeshemSeason(hd)) {
    insertions.push({ key: 'geshem', he: 'משיב הרוח ומוריד הגשם', en: 'Mashiv haruach u\'morid hageshem' });
  } else if (opts.saysMoridHatal) {
    insertions.push({ key: 'tal', he: 'מוריד הטל', en: 'Morid hatal' });
  }

  // --- Rain in birkas hashanim ---
  insertions.push(
    saysTalUmatar(hd, opts.inIsrael)
      ? { key: 'talumatar', he: 'ותן טל ומטר לברכה', en: "V'sein tal umatar livracha" }
      : { key: 'bracha', he: 'ותן ברכה', en: "V'sein bracha" },
  );

  // --- Ya'aleh v'yavo ---
  const isCholHamoed = keys.some((k) => /Chol ha-Moed/i.test(k));
  const isYomTov = keys.some((k) => /^(Pesach|Sukkot|Shavuot|Rosh Hashana|Yom Kippur|Shmini Atzeret|Simchat Torah)/i.test(k));
  if (isRoshChodesh(hd) || isCholHamoed || isYomTov) {
    insertions.push({ key: 'yaaleh', he: 'יעלה ויבוא', en: "Ya'aleh v'yavo" });
  }

  // --- Al hanisim ---
  const chanukah = chanukahDay(hd);
  if (chanukah !== null) {
    insertions.push({
      key: 'alhanisim',
      he: `על הנסים · חנוכה`,
      en: 'Al hanisim — Chanukah',
      note: `נר ${chanukah}`,
      noteEn: `Night ${chanukah}`,
    });
  } else if (keys.some((k) => /^Purim$/i.test(k))) {
    // Shushan Purim is deliberately not here — outside a walled city it takes
    // no al hanisim.
    insertions.push({ key: 'alhanisim', he: 'על הנסים · פורים', en: 'Al hanisim — Purim' });
  }

  // --- Aneinu on a public fast ---
  if (keys.some((k) => /Tzom|Asara B'Tevet|Ta'anit|Tish'a B'Av/i.test(k))) {
    insertions.push({ key: 'aneinu', he: 'עננו', en: 'Aneinu', note: 'תענית ציבור', noteEn: 'Public fast' });
  }

  return {
    insertions,
    tachanun: tachanunFor(hd, opts.inIsrael),
    hallel: hallelFor(hd, opts.inIsrael),
    kiddushLevana: kiddushLevanaFor(hd, opts),
    molad: moladAnnouncement(hd, opts),
  };
}
