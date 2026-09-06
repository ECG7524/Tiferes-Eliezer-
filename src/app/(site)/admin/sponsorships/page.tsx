import { asc, gte } from 'drizzle-orm';
import { db } from '@/db';
import { sponsorships } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { todayISO, fmtDate, addDaysISO } from '@/lib/zmanim';
import { formatMoney } from '@/lib/money';
import { saveSponsorshipAction, deleteSponsorshipAction, generateSlotsAction } from '@/actions/sponsorships';
import { PageHeader, Card, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KINDS = ['kiddush', 'shalosh_seudos', 'seudas_yom_tov', 'melava_malka'] as const;
const STATUSES = ['open', 'requested', 'confirmed', 'cancelled'] as const;

export default async function AdminSponsorshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string; all?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);

  // Recent past is worth keeping visible so a gabbai can chase what wasn't paid.
  const since = sp.all ? '0000-01-01' : addDaysISO(today, -60, tz);

  const rows = await db
    .select()
    .from(sponsorships)
    .where(gte(sponsorships.date, since))
    .orderBy(asc(sponsorships.date), asc(sponsorships.kind))
    .limit(400);

  const editing = sp.edit ? rows.find((r) => r.id === Number(sp.edit)) : undefined;
  const requested = rows.filter((r) => r.status === 'requested');

  return (
    <>
      <PageHeader
        eyebrow="Shabbos calendar"
        title="Kiddush &amp; Seudos"
        subtitle="Open dates for members to claim, and a record of who sponsored what."
        actions={
          <a href={sp.all ? '/admin/sponsorships' : '/admin/sponsorships?all=1'} className="btn-ghost btn-sm">
            {sp.all ? 'Recent only' : 'Show all history'}
          </a>
        }
      />

      <Flash ok={sp.ok} error={sp.error} />

      {requested.length > 0 && (
        <div className="mb-6 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>{requested.length}</strong> sponsorship request
          {requested.length === 1 ? '' : 's'} waiting for you to confirm.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <Empty>Nothing on the calendar. Open some dates alongside.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr><th>Date</th><th>Kind</th><th>Sponsor</th><th>Status</th><th className="text-right">Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.date < today ? 'opacity-60' : ''}>
                      <td className="whitespace-nowrap">
                        <span className="block font-medium text-walnut-800">{fmtDate(r.date, tz, 'LLL d, yyyy')}</span>
                        {r.label && <span className="block text-xs text-gold-700">{r.label}</span>}
                      </td>
                      <td className="text-xs capitalize text-walnut-500">{r.kind.replace(/_/g, ' ')}</td>
                      <td>
                        {r.sponsorName ? (
                          <>
                            <span className="block text-walnut-800">{r.sponsorName}</span>
                            {r.occasion && <span className="block text-xs text-walnut-400">{r.occasion}</span>}
                          </>
                        ) : <span className="text-walnut-400">—</span>}
                      </td>
                      <td><Badge value={r.status} /></td>
                      <td className="text-right tabular-nums text-walnut-700">
                        {r.amountCents ? formatMoney(r.amountCents) : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/sponsorships?edit=${r.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        <form action={deleteSponsorshipAction} className="mt-1">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card title={editing ? 'Edit slot' : 'Add a slot'}>
            <form action={saveSponsorshipAction} className="space-y-3" key={editing?.id ?? 'new'}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <div>
                <label className="label" htmlFor="s-date">Date</label>
                <input id="s-date" name="date" type="date" required defaultValue={editing?.date} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-kind">Kind</label>
                <select id="s-kind" name="kind" defaultValue={editing?.kind ?? 'kiddush'} className="select">
                  {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="s-label">Label</label>
                <input id="s-label" name="label" defaultValue={editing?.label ?? ''} className="input" placeholder="Parashas Noach" />
              </div>
              <div>
                <label className="label" htmlFor="s-sponsor">Sponsor</label>
                <input id="s-sponsor" name="sponsorName" defaultValue={editing?.sponsorName ?? ''} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-occ">Occasion</label>
                <input id="s-occ" name="occasion" defaultValue={editing?.occasion ?? ''} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-co">Co-sponsors</label>
                <input id="s-co" name="coSponsors" defaultValue={editing?.coSponsors ?? ''} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="s-amt">Amount</label>
                  <input id="s-amt" name="amountCents" inputMode="decimal" defaultValue={editing ? editing.amountCents / 100 : ''} className="input tabular-nums" />
                </div>
                <div>
                  <label className="label" htmlFor="s-status">Status</label>
                  <select id="s-status" name="status" defaultValue={editing?.status ?? 'open'} className="select">
                    {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">{editing ? 'Save' : 'Add slot'}</button>
              {editing && <a href="/admin/sponsorships" className="btn-ghost w-full">Cancel</a>}
            </form>
          </Card>

          <Card title="Open up the coming weeks">
            <form action={generateSlotsAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="g-weeks">How many Shabbosos ahead?</label>
                <input id="g-weeks" name="weeks" type="number" min={1} max={52} defaultValue={12} className="input tabular-nums" />
              </div>
              <fieldset>
                <legend className="label">Open which slots?</legend>
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="kinds" value="kiddush" defaultChecked className="accent-gold-600" /> Kiddush
                </label>
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="kinds" value="shalosh_seudos" defaultChecked className="accent-gold-600" /> Shalosh Seudos
                </label>
              </fieldset>
              <button type="submit" className="btn-ghost w-full">Create open slots</button>
              <p className="text-xs text-walnut-400">
                Existing dates are left alone, and each slot is labelled with that week&apos;s parsha.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
