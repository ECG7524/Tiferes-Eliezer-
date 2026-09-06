import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pledges, donationCategories } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { Card } from '@/components/ui';

export const metadata = { title: 'Thank you' };
export const dynamic = 'force-dynamic';

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ pledge?: string; paid?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const id = Number(sp.pledge) || 0;
  const paid = sp.paid === '1';

  const row = id
    ? (
        await db
          .select({ pledge: pledges, category: donationCategories })
          .from(pledges)
          .leftJoin(donationCategories, eq(pledges.categoryId, donationCategories.id))
          .where(eq(pledges.id, id))
          .limit(1)
      )[0]
    : null;

  return (
    <div className="mx-auto max-w-xl py-8">
      <Card>
        <div className="text-center">
          <p className="he font-hebrew text-3xl text-gold-700">תזכו למצוות</p>
          <h1 className="mt-3 text-3xl">Thank you</h1>
          <hr className="rule-gold my-5" />

          {row ? (
            <>
              <p className="text-walnut-600">
                {paid
                  ? 'Your gift has been received.'
                  : 'Your pledge has been recorded. The shul office will be in touch about settling it.'}
              </p>
              <dl className="mx-auto mt-6 max-w-xs space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut-500">Amount</dt>
                  <dd className="font-semibold tabular-nums text-walnut-800">{formatMoney(row.pledge.amountCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut-500">For</dt>
                  <dd className="font-medium text-walnut-800">{row.category?.name ?? 'General fund'}</dd>
                </div>
                {row.pledge.occasion && (
                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-walnut-500">Dedication</dt>
                    <dd className="text-right text-walnut-800">{row.pledge.occasion}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-walnut-500">Reference</dt>
                  <dd className="tabular-nums text-walnut-800">#{row.pledge.id}</dd>
                </div>
              </dl>
              {paid && (
                <p className="mt-5 text-xs text-walnut-400">
                  A receipt has been emailed to you. It may take a moment to appear in your giving history.
                </p>
              )}
            </>
          ) : (
            <p className="text-walnut-600">Your gift to {settings.nameEn} is much appreciated.</p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link href="/" className="btn-ghost">Back to the shul</Link>
            <Link href="/account" className="btn-primary">My giving</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
