import { HDate } from '@hebcal/core';
import {
  DafYomi, DafYomiEvent,
  NachYomiIndex, NachYomiEvent,
  dirshuDafHalacha, DirshuDafHalachaEvent,
} from '@hebcal/learning';
import { getLeyningOnDate, formatAliyahShort } from '@hebcal/leyning';
import type { Leyning, LeyningWeekday } from '@hebcal/leyning';

/** One line of the לימוד יומי panel. */
export interface LearningItem {
  key: 'daf' | 'nach' | 'dirshu' | 'chumash';
  labelHe: string;
  labelEn: string;
  /** What is being learned today, already in Hebrew. */
  valueHe: string;
  valueEn: string;
}

/** Which cycles a shul can put on the board. */
export const LEARNING_CYCLES: { key: LearningItem['key']; labelHe: string; labelEn: string }[] = [
  { key: 'chumash', labelHe: 'חומש', labelEn: 'Chumash' },
  { key: 'daf', labelHe: 'דף יומי', labelEn: 'Daf Yomi' },
  { key: 'nach', labelHe: 'נ״ך יומי', labelEn: 'Nach Yomi' },
  { key: 'dirshu', labelHe: 'דף היומי בהלכה', labelEn: "Daf HaYomi B'Halacha" },
];

/* ------------------------------------------------------------------ */
/* Hebrew names hebcal does not translate for us                       */
/* ------------------------------------------------------------------ */

const CHUMASH_HE: Record<string, string> = {
  Genesis: 'בראשית',
  Exodus: 'שמות',
  Leviticus: 'ויקרא',
  Numbers: 'במדבר',
  Deuteronomy: 'דברים',
};

/** Sunday takes rishon, Monday sheni, and so on through the week. */
const ALIYAH_BY_WEEKDAY: { num: string; he: string; en: string }[] = [
  { num: '1', he: 'ראשון', en: 'Rishon' },
  { num: '2', he: 'שני', en: 'Sheni' },
  { num: '3', he: 'שלישי', en: 'Shlishi' },
  { num: '4', he: 'רביעי', en: "Revi'i" },
  { num: '5', he: 'חמישי', en: 'Chamishi' },
  { num: '6', he: 'שישי', en: 'Shishi' },
  { num: '7', he: 'שביעי', en: "Shvi'i" },
];

/**
 * The Shabbos whose parsha this week's chumash is building towards. When the
 * coming Shabbos is Yom Tov it has no parsha of its own — the cycle carries on
 * to the next Shabbos that does, which through Tishrei can be several weeks
 * out.
 */
function upcomingParshaLeyning(from: HDate, inIsrael: boolean): Leyning | null {
  for (let week = 0; week < 6; week++) {
    const shabbos = from.add(week * 7, 'd');
    const leyning = parshaLeyning(getLeyningOnDate(shabbos, inIsrael));
    if (leyning) return leyning;
  }
  return null;
}

/**
 * Narrows a day's reading to a regular weekly parsha. A weekday reading has no
 * full kriyah, and a Yom Tov reading carries no `parsha` — neither drives the
 * chumash cycle.
 */
function parshaLeyning(reading: Leyning | LeyningWeekday | undefined): Leyning | null {
  if (!reading || !('fullkriyah' in reading)) return null;
  const leyning = reading as Leyning;
  return leyning.parsha ? leyning : null;
}

/**
 * The day's portion of the coming Shabbos's parsha. On Shabbos itself the
 * whole parsha is read, so we name the parsha rather than one aliyah.
 */
function chumashFor(hd: HDate, inIsrael: boolean): LearningItem | null {
  const dow = hd.getDay(); // 0 = Sunday … 6 = Shabbos

  // On Shabbos the whole parsha is laining, so today's own reading is the
  // answer — and if today is Yom Tov there is no parsha, and no portion due.
  if (dow === 6) {
    const today = parshaLeyning(getLeyningOnDate(hd, inIsrael));
    if (!today) return null;
    return {
      key: 'chumash',
      labelHe: 'חומש',
      labelEn: 'Chumash',
      valueHe: `${today.name?.he ?? ''} — כל הפרשה`,
      valueEn: `${today.name?.en ?? ''} — whole parsha`,
    };
  }

  const leyning = upcomingParshaLeyning(hd.add(6 - dow, 'd'), inIsrael);
  if (!leyning) return null;

  const slot = ALIYAH_BY_WEEKDAY[dow];
  const aliyah = leyning.fullkriyah[slot.num];
  if (!aliyah) return null;

  const bookHe = CHUMASH_HE[aliyah.k] ?? aliyah.k;

  return {
    key: 'chumash',
    labelHe: 'חומש',
    labelEn: 'Chumash',
    valueHe: `${leyning.name?.he ?? ''} — ${slot.he} · ${bookHe} ${verseRange(aliyah.b, aliyah.e)}`,
    valueEn: `${leyning.name?.en ?? ''} — ${slot.en} · ${formatAliyahShort(aliyah, true)}`,
  };
}

/**
 * "6:9-22" within one chapter, but "49:27-50:20" when the aliyah runs across
 * a chapter break — dropping the chapter there would read as going backwards.
 */
function verseRange(begin: string, end: string): string {
  const [startChapter] = begin.split(':');
  const [endChapter, endVerse] = end.split(':');
  return startChapter === endChapter ? `${begin}-${endVerse}` : `${begin}-${end}`;
}

/* ------------------------------------------------------------------ */

/**
 * What the shul is learning today. Anything a cycle can't answer for — a date
 * before Daf Yomi began, or outside the current Dirshu machzor — is simply
 * left off rather than shown blank.
 */
export function getLearning(
  hd: HDate,
  enabled: LearningItem['key'][],
  inIsrael = false,
): LearningItem[] {
  const want = new Set(enabled);
  const out: LearningItem[] = [];

  if (want.has('chumash')) {
    const c = safely(() => chumashFor(hd, inIsrael));
    if (c) out.push(c);
  }

  if (want.has('daf')) {
    safely(() => {
      // Constructing DafYomi first surfaces the "before 1923" case as a throw.
      new DafYomi(hd);
      const ev = new DafYomiEvent(hd);
      out.push({
        key: 'daf',
        labelHe: 'דף יומי',
        labelEn: 'Daf Yomi',
        valueHe: strip(ev.render('he'), 'דַּף יוֹמִי:'),
        valueEn: strip(ev.render('en'), 'Daf Yomi:'),
      });
    });
  }

  if (want.has('nach')) {
    safely(() => {
      const idx = new NachYomiIndex();
      const ev = new NachYomiEvent(hd, idx.lookup(hd));
      out.push({
        key: 'nach',
        labelHe: 'נ״ך יומי',
        labelEn: 'Nach Yomi',
        valueHe: strip(ev.render('he'), 'נ״ך יומי:'),
        valueEn: strip(ev.render('en'), 'Nach Yomi:'),
      });
    });
  }

  if (want.has('dirshu')) {
    safely(() => {
      const daf = dirshuDafHalacha(hd);
      if (!daf) return;
      const ev = new DirshuDafHalachaEvent(hd, daf);
      out.push({
        key: 'dirshu',
        labelHe: 'דף היומי בהלכה',
        labelEn: "Daf HaYomi B'Halacha",
        valueHe: strip(ev.render('he'), 'דַף הַיוֹמִי בַּהֲלָכָה:'),
        // The Hebrew rendering already says חזרה on a review day.
        valueEn: strip(ev.render('en'), "Daf HaYomi B'Halacha:"),
      });
    });
  }

  return out;
}

/** hebcal prefixes each rendering with the cycle's own name; the panel already labels it. */
function strip(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : text;
}

function safely<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    // A cycle that has no answer for this date just doesn't appear.
    return null;
  }
}
