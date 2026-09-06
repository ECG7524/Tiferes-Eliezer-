import { HDate, months } from '@hebcal/core';

/** The Hebrew months, with Adar I / Adar II both offered since a petirah can fall in either. */
export const HEBREW_MONTHS: { value: number; label: string; he: string }[] = [
  { value: months.TISHREI, label: 'Tishrei', he: 'תשרי' },
  { value: months.CHESHVAN, label: 'Cheshvan', he: 'חשון' },
  { value: months.KISLEV, label: 'Kislev', he: 'כסלו' },
  { value: months.TEVET, label: 'Teves', he: 'טבת' },
  { value: months.SHVAT, label: 'Shevat', he: 'שבט' },
  { value: months.ADAR_I, label: 'Adar (Adar I)', he: 'אדר א' },
  { value: months.ADAR_II, label: 'Adar II', he: 'אדר ב' },
  { value: months.NISAN, label: 'Nisan', he: 'ניסן' },
  { value: months.IYYAR, label: 'Iyar', he: 'אייר' },
  { value: months.SIVAN, label: 'Sivan', he: 'סיון' },
  { value: months.TAMUZ, label: 'Tammuz', he: 'תמוז' },
  { value: months.AV, label: 'Av', he: 'אב' },
  { value: months.ELUL, label: 'Elul', he: 'אלול' },
];

export function hebrewMonthLabel(month: number): string {
  return HEBREW_MONTHS.find((m) => m.value === month)?.label ?? String(month);
}

/** Current Hebrew year, used as the default when adding a yahrzeit. */
export function currentHebrewYear(): number {
  return new HDate().yy;
}
