import { asc, eq, sql, and, desc } from 'drizzle-orm';
import { db } from '@/db';
import { donationCategories, payments } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { isStripeEnabled } from '@/lib/stripe';
import { formatMoney } from '@/lib/money';
import { donateAction } from '@/actions/donations';
import { DonateForm, type DonateCategory } from '@/components/DonateForm';
import { PageHeader, Card, Flash } from '@/components/ui';

export const metadata = { title: 'Donate' };
export const dynamic = 'force-dynamic';

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; fund?: string }>;
}) {
  const [sp, settings, user, cats] = await Promise.all([
    searchParams,
    getSettings(),
    getCurrentUser(),
    db.select().from(donationCategories).where(eq(donationCategories.active, true)).orderBy(asc(donationCategories.sortOrder), asc(donationCategories.name)),
  ]);

  const categories: DonateCategory[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    nameHe: c.nameHe,
    description: c.description,
    allowCustomAmount: c.allowCustomAmount,
    suggestedAmounts: safeAmounts(c.suggestedAmounts),
  }));

  const defaultCategoryId = sp.fund ? cats.find((c) => c.slug === sp.fund)?.id : undefined;

  // Funds with a stated goal get a progress bar, which is what actually moves
  // people on a building campaign.
  const withGoals = cats.filter((c) => (c.goalCents ?? 0) > 0);
  const progress = withGoals.length
    ? await db
        .select({
          categoryId: payments.categoryId,
          raised: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
        })
        .from(payments)
        .where(and(eq(payments.status, 'succeeded'), sql`${payments.categoryId} in ${withGoals.map((c) => c.id)}`))
        .groupBy(payments.categoryId)
    : [];

  const raisedFor = new Map(progress.map((p) => [p.categoryId, Number(p.raised) || 0]));

  const recent = await db
    .select({
      donorName: payments.donorName,
      amountCents: payments.amountCents,
      paidAt: payments.paidAt,
      categoryName: donationCategories.name,
    })
    .from(payments)
    .leftJoin(donationCategories, eq(payments.categoryId, donationCategories.id))
    .where(eq(payments.status, 'succeeded'))
    .orderBy(desc(payments.paidAt))
    .limit(6);

  return (
    <>
      <PageHeader
        eyebrow="Support the shul"
        title="Donate"
        titleHe="תרומות"
        subtitle={`Every gift to ${settings.nameEn} — from a kiddush to an aliyah to the building fund — is recorded here so you always have a clear account of your giving.`}
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <DonateForm
              categories={categories}
              action={donateAction}
              stripeEnabled={isStripeEnabled()}
              defaultCategoryId={defaultCategoryId}
              donor={user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : null}
            />
          </Card>
        </div>

        <aside className="space-y-6">
          {withGoals.length > 0 && (
            <Card title="Campaign progress">
              <div className="space-y-5">
                {withGoals.map((c) => {
                  const raised = raisedFor.get(c.id) ?? 0;
                  const goal = c.goalCents ?? 0;
                  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-walnut-800">{c.name}</span>
                        <span className="text-xs tabular-nums text-walnut-500">{pct}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold-100">
                        <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-walnut-500">
                        {formatMoney(raised)} raised of {formatMoney(goal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {recent.length > 0 && (
            <Card title="Recent giving">
              <ul className="space-y-3">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-walnut-700">{r.donorName}</span>
                      <span className="block truncate text-xs text-walnut-400">{r.categoryName ?? 'General'}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-gold-700">
                      {formatMoney(r.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Other ways to give">
            <ul className="space-y-2.5 text-sm text-walnut-600">
              <li>
                Cheques payable to <strong className="text-walnut-800">{settings.nameEn}</strong>,{' '}
                {settings.addressLine}, {settings.city}, {settings.state} {settings.zip}.
              </li>
              {settings.zelleTo && (
                <li>Zelle — <strong className="text-walnut-800">{settings.zelleTo}</strong></li>
              )}
              {settings.quickPayTo && (
                <li>QuickPay — <strong className="text-walnut-800">{settings.quickPayTo}</strong></li>
              )}
              {settings.phone && (
                <li>Call or text <a href={`tel:${settings.phone}`} className="text-gold-700 hover:underline">{settings.phone}</a></li>
              )}
              <li>Cash handed to a gabbai is entered into this same ledger.</li>
            </ul>
            {settings.taxId && (
              <p className="mt-4 border-t border-gold-100 pt-3 text-xs text-walnut-400">
                All donations are tax deductible. Registered 501(c)(3), EIN {settings.taxId}.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function safeAmounts(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((n) => typeof n === 'number' && n > 0);
  } catch { /* fall through to the house default */ }
  return [1800, 3600, 5400, 10000];
}
