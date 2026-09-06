import { and, gte, lte, or, like, eq, desc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { payments, donationCategories } from '@/db/schema';
import { getCurrentUser, atLeast } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** Downloads the ledger as CSV so the treasurer can hand it to the accountant. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!atLeast(user, 'gabbai')) {
    return new Response('Not authorised', { status: 403 });
  }

  const settings = await getSettings();
  const tz = settings.timezone;
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const q = (url.searchParams.get('q') ?? '').trim();

  const filters = [
    ...(from ? [gte(payments.paidAt, Math.floor(new Date(`${from}T00:00:00`).getTime() / 1000))] : []),
    ...(to ? [lte(payments.paidAt, Math.floor(new Date(`${to}T23:59:59`).getTime() / 1000))] : []),
    ...(q ? [or(like(payments.donorName, `%${q}%`), like(payments.donorEmail, `%${q}%`), like(payments.reference, `%${q}%`))!] : []),
  ];

  const rows = await db
    .select({ payment: payments, category: donationCategories.name })
    .from(payments)
    .leftJoin(donationCategories, eq(payments.categoryId, donationCategories.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(payments.paidAt));

  const header = [
    'Payment ID', 'Date', 'Donor', 'Email', 'Fund', 'Method',
    'Reference', 'Status', 'Amount', 'Pledge ID', 'Notes',
  ];

  const lines = [
    header.join(','),
    ...rows.map(({ payment: p, category }) =>
      [
        p.id,
        DateTime.fromSeconds(p.paidAt, { zone: tz }).toFormat('yyyy-LL-dd'),
        p.donorName,
        p.donorEmail ?? '',
        category ?? '',
        p.method,
        p.reference ?? '',
        p.status,
        (p.amountCents / 100).toFixed(2),
        p.pledgeId ?? '',
        p.notes ?? '',
      ].map(csvCell).join(','),
    ),
  ];

  const filename = `donations-${from ?? 'all'}-to-${to ?? DateTime.now().setZone(tz).toISODate()}.csv`;

  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Quotes a CSV cell. The leading apostrophe on formula characters stops a
 * spreadsheet treating a donor's name as a formula.
 */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
