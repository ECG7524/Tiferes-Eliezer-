import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { donationCategories, payments } from '@/db/schema';
import { formatMoney } from '@/lib/money';
import { saveCategoryAction, deleteCategoryAction } from '@/actions/donations';
import { PageHeader, Card, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KINDS = [
  'general', 'kiddush', 'shalosh_seudos', 'seats', 'aliyos', 'building', 'membership', 'other',
] as const;

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string }>;
}) {
  const sp = await searchParams;

  const rows = await db
    .select({
      category: donationCategories,
      received: sql<number>`coalesce(sum(case when ${payments.status} = 'succeeded' then ${payments.amountCents} else 0 end), 0)`,
    })
    .from(donationCategories)
    .leftJoin(payments, eq(payments.categoryId, donationCategories.id))
    .groupBy(donationCategories.id)
    .orderBy(asc(donationCategories.sortOrder), asc(donationCategories.name));

  const editing = sp.edit ? rows.find((r) => r.category.id === Number(sp.edit))?.category : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Giving"
        title="Funds"
        subtitle="The list donors choose from on the donation page. Retiring a fund hides it from donors but keeps its history intact."
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <Empty>No funds yet — add the first one alongside.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr><th>Fund</th><th>Kind</th><th className="text-right">Received</th><th className="text-right">Goal</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map(({ category: c, received }) => (
                    <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                      <td>
                        <span className="flex items-baseline gap-2">
                          <span className="font-medium text-walnut-800">{c.name}</span>
                          {c.nameHe && <span className="he font-hebrew text-xs text-gold-700">{c.nameHe}</span>}
                          {!c.active && <Badge value="disabled" label="retired" />}
                        </span>
                        {c.description && <span className="block text-xs text-walnut-400">{c.description}</span>}
                      </td>
                      <td className="text-xs capitalize text-walnut-500">{c.kind.replace(/_/g, ' ')}</td>
                      <td className="text-right font-semibold tabular-nums text-walnut-800">{formatMoney(Number(received))}</td>
                      <td className="text-right tabular-nums text-walnut-400">
                        {c.goalCents ? formatMoney(c.goalCents) : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/categories?edit=${c.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        {c.active && (
                          <form action={deleteCategoryAction} className="mt-1">
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Retire</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card title={editing ? `Edit “${editing.name}”` : 'Add a fund'}>
          <form action={saveCategoryAction} className="space-y-3" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="label" htmlFor="c-name">Name</label>
              <input id="c-name" name="name" required defaultValue={editing?.name} className="input" placeholder="Kiddush Fund" />
            </div>
            <div>
              <label className="label" htmlFor="c-nameHe">Hebrew name</label>
              <input id="c-nameHe" name="nameHe" dir="rtl" defaultValue={editing?.nameHe ?? ''} className="input font-hebrew" />
            </div>
            <div>
              <label className="label" htmlFor="c-desc">Description</label>
              <input id="c-desc" name="description" defaultValue={editing?.description ?? ''} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="c-kind">Kind</label>
              <select id="c-kind" name="kind" defaultValue={editing?.kind ?? 'general'} className="select">
                {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="c-amounts">Suggested amounts</label>
              <input
                id="c-amounts" name="suggestedAmounts"
                defaultValue={safeAmounts(editing?.suggestedAmounts).map((c) => c / 100).join(', ')}
                className="input" placeholder="18, 36, 54, 100"
              />
              <p className="mt-1 text-xs text-walnut-400">Comma separated, in dollars.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="c-goal">Goal</label>
                <input id="c-goal" name="goalCents" inputMode="decimal" defaultValue={editing?.goalCents ? editing.goalCents / 100 : ''} className="input tabular-nums" placeholder="0" />
              </div>
              <div>
                <label className="label" htmlFor="c-sort">Order</label>
                <input id="c-sort" name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} className="input tabular-nums" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-walnut-600">
              <input type="checkbox" name="allowCustomAmount" defaultChecked={editing?.allowCustomAmount ?? true} className="accent-gold-600" />
              Allow a custom amount
            </label>
            <label className="flex items-center gap-2 text-sm text-walnut-600">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="accent-gold-600" />
              Show on the donation page
            </label>
            <button type="submit" className="btn-primary w-full">{editing ? 'Save changes' : 'Add fund'}</button>
            {editing && <a href="/admin/categories" className="btn-ghost w-full">Cancel</a>}
          </form>
        </Card>
      </div>
    </>
  );
}

function safeAmounts(json: string | undefined): number[] {
  if (!json) return [1800, 3600, 5400, 10000];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((n) => typeof n === 'number');
  } catch { /* fall through */ }
  return [1800, 3600, 5400, 10000];
}
