import { and, asc, sql, eq, or, like } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { users, payments, pledges } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { updateMemberAction, approveMemberAction, resetMemberPasswordAction } from '@/actions/admin';
import { PageHeader, Card, Stat, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string; q?: string }>;
}) {
  const [sp, settings, me] = await Promise.all([searchParams, getSettings(), getCurrentUser()]);
  const tz = settings.timezone;
  const q = (sp.q ?? '').trim();

  // Aggregates are fetched separately and stitched together here: a correlated
  // subquery per member reads worse and scales worse than three flat queries.
  const [memberRows, givenRows, pledgedRows, paidOnOpenRows] = await Promise.all([
    db
      .select()
      .from(users)
      .where(q ? or(like(users.lastName, `%${q}%`), like(users.firstName, `%${q}%`), like(users.email, `%${q}%`)) : undefined)
      .orderBy(asc(users.lastName), asc(users.firstName))
      .limit(500),
    db
      .select({ userId: payments.userId, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .where(eq(payments.status, 'succeeded'))
      .groupBy(payments.userId),
    db
      .select({ userId: pledges.userId, total: sql<number>`coalesce(sum(${pledges.amountCents}), 0)` })
      .from(pledges)
      .where(sql`${pledges.status} in ('open', 'partial')`)
      .groupBy(pledges.userId),
    // What has already been paid against those still-open pledges.
    db
      .select({ userId: pledges.userId, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .innerJoin(pledges, eq(payments.pledgeId, pledges.id))
      .where(and(eq(payments.status, 'succeeded'), sql`${pledges.status} in ('open', 'partial')`))
      .groupBy(pledges.userId),
  ]);

  const givenBy = new Map(givenRows.map((r) => [r.userId, Number(r.total) || 0]));
  const pledgedBy = new Map(pledgedRows.map((r) => [r.userId, Number(r.total) || 0]));
  const paidOnOpenBy = new Map(paidOnOpenRows.map((r) => [r.userId, Number(r.total) || 0]));

  const rows = memberRows.map((user) => ({
    user,
    given: givenBy.get(user.id) ?? 0,
    owing: Math.max(0, (pledgedBy.get(user.id) ?? 0) - (paidOnOpenBy.get(user.id) ?? 0)),
  }));

  const editing = sp.edit ? rows.find((r) => r.user.id === Number(sp.edit))?.user : undefined;
  const pending = rows.filter((r) => r.user.status === 'pending');
  const active = rows.filter((r) => r.user.status === 'active');

  return (
    <>
      <PageHeader
        eyebrow="Kehilla"
        title="Members"
        subtitle="Approve new accounts, set who may run the shul modules, and see each family's giving at a glance."
        actions={
          <form action="/admin/members" className="flex items-end gap-2">
            <input name="q" defaultValue={q} placeholder="Search name or email" className="input py-1.5 text-xs" />
            <button type="submit" className="btn-ghost btn-sm">Search</button>
          </form>
        }
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={String(active.length)} />
        <Stat label="Waiting for approval" value={String(pending.length)} tone={pending.length ? 'warn' : 'default'} />
        <Stat label="Gabbaim & admins" value={String(active.filter((r) => r.user.role !== 'member').length)} />
      </div>

      {pending.length > 0 && (
        <Card className="mt-6" title="Waiting for approval">
          <table className="table-shul">
            <tbody>
              {pending.map(({ user: u }) => (
                <tr key={u.id}>
                  <td>
                    <span className="block font-medium text-walnut-800">{u.firstName} {u.lastName}</span>
                    <span className="block text-xs text-walnut-400">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span>
                  </td>
                  <td className="text-xs text-walnut-400">
                    Signed up {DateTime.fromSeconds(u.createdAt, { zone: tz }).toRelative()}
                  </td>
                  <td className="text-right">
                    <form action={approveMemberAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="btn-gold btn-sm">Approve</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <Empty>No members match.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Status</th><th className="text-right">Given</th><th className="text-right">Owing</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map(({ user: u, given, owing }) => (
                    <tr key={u.id} className={u.status === 'active' ? '' : 'opacity-60'}>
                      <td>
                        <span className="block font-medium text-walnut-800">
                          {u.lastName}, {u.firstName}
                          {u.id === me?.id && <span className="ml-2 text-xs text-gold-700">(you)</span>}
                        </span>
                        <span className="block text-xs text-walnut-400">{u.email}</span>
                        {u.hebrewName && <span className="he block font-hebrew text-xs text-gold-700">{u.hebrewName}</span>}
                      </td>
                      <td><Badge value={u.role} /></td>
                      <td><Badge value={u.status} /></td>
                      <td className="text-right tabular-nums text-emerald-700">{formatMoney(given)}</td>
                      <td className="text-right tabular-nums text-amber-700">
                        {owing > 0 ? formatMoney(owing) : '—'}
                      </td>
                      <td className="text-right">
                        <a href={`/admin/members?edit=${u.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <div className="space-y-6">
            <Card title={`${editing.firstName} ${editing.lastName}`}>
              <form action={updateMemberAction} className="space-y-3" key={editing.id}>
                <input type="hidden" name="id" value={editing.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="u-first">First name</label>
                    <input id="u-first" name="firstName" defaultValue={editing.firstName} className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="u-last">Last name</label>
                    <input id="u-last" name="lastName" defaultValue={editing.lastName} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="u-heb">Hebrew name</label>
                  <input id="u-heb" name="hebrewName" dir="rtl" defaultValue={editing.hebrewName ?? ''} className="input font-hebrew" />
                </div>
                <div>
                  <label className="label" htmlFor="u-phone">Phone</label>
                  <input id="u-phone" name="phone" type="tel" defaultValue={editing.phone ?? ''} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="u-role">Role</label>
                    <select id="u-role" name="role" defaultValue={editing.role} className="select">
                      <option value="member">Member</option>
                      <option value="gabbai">Gabbai</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="u-status">Status</label>
                    <select id="u-status" name="status" defaultValue={editing.status} className="select">
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="u-notes">Office notes</label>
                  <textarea id="u-notes" name="notes" rows={2} defaultValue={editing.notes ?? ''} className="textarea" />
                </div>
                <button type="submit" className="btn-primary w-full">Save changes</button>
                <a href="/admin/members" className="btn-ghost w-full">Close</a>
              </form>
              <p className="mt-3 text-xs text-walnut-400">
                A gabbai runs the shul modules. An administrator can also manage members and settings.
              </p>
            </Card>

            <Card title="Reset password">
              <form action={resetMemberPasswordAction} className="space-y-3">
                <input type="hidden" name="id" value={editing.id} />
                <div>
                  <label className="label" htmlFor="u-pw">New password</label>
                  <input id="u-pw" name="password" type="text" minLength={8} required className="input" placeholder="At least 8 characters" />
                </div>
                <button type="submit" className="btn-ghost w-full">Set new password</button>
                <p className="text-xs text-walnut-400">
                  They will be signed out everywhere. Pass the new password on to them directly — it is not emailed.
                </p>
              </form>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
