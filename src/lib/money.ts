/** Money lives in the database as integer cents; it only becomes a decimal on screen. */

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parses "180", "$180.00", "1,800" into cents. Returns null if it isn't a number. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null;
  const cleaned = String(input).replace(/[$,\s]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Chai multiples, the amounts a shul actually gets asked for. */
export const CHAI_AMOUNTS = [1800, 3600, 5400, 10000, 18000, 36000];
