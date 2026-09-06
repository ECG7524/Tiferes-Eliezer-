import { asc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { yahrzeits, users } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { yahrzeitInYear, todayISO } from '@/lib/zmanim';
import { HEBREW_MONTHS, hebrewMonthLabel, currentHebrewYear } from '@/lib/hebrewMonths';
import { saveYahrzeitAction, deleteYahrzeitAction } from '@/actions/content';
import { PageHeader, Card, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminYahrzeitsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);
  const thisYear = currentHebrewYear();

  const [rows, members] = await Promise.all([
    db
      .select({ y: yahrzeits, firstName: users.firstName, lastName: users.lastName })
      .from(yahrzeits)
      .leftJoin(users, eq(yahrzeits.userId, users.id))
      .orderBy(asc(yahrzeits.hebrewMonth), asc(yahrzeits.hebrewDay)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.status, 'active')).orderBy(asc(users.lastName)),
  ]);

  const editing = sp.edit ? rows.find((r) => r.y.id === Number(sp.edit))?.y : undefined;

  // Work out this year's civil date for each, then sort by what is coming next.
  const withDates = rows
    .map((r) => {
      let greg = yahrzeitInYear(r.y.hebrewDay, r.y.hebrewMonth, thisYear);
      let iso = DateTime.fromJSDate(greg).toISODate()!;
      // Once it has passed this Hebrew year, show next year's date instead.
      if (iso < today) {
        greg = yahrzeitInYear(r.y.hebrewDay, r.y.hebrewMonth, thisYear + 1);
        iso = DateTime.fromJSDate(greg).toISODate()!;
      }
      return { ...r, iso };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  return (
    <>
      <PageHeader
        eyebrow="Zecher"
        title="Yahrzeits"
        titleHe="יארצייטן"
        subtitle="Recorded against the Hebrew date of the petirah, so the civil date is worked out correctly every year — including leap years and short Cheshvans."
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {withDates.length === 0 ? (
            <Empty>No yahrzeits recorded. Members can also add their own from their account page.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-shul">
                <thead>
                  <tr><th>Next date</th><th>Hebrew date</th><th>Niftar</th><th>Recorded by</th><th></th></tr>
                </thead>
                <tbody>
                  {withDates.map(({ y, firstName, lastName, iso }) => (
                    <tr key={y.id}>
                      <td className="whitespace-nowrap font-medium text-walnut-800">
                        {DateTime.fromISO(iso).toFormat('LLL d, yyyy')}
                      </td>
                      <td className="whitespace-nowrap text-sm text-gold-700">
                        {y.hebrewDay} {hebrewMonthLabel(y.hebrewMonth)}
                      </td>
                      <td>
                        <span className="block text-walnut-800">{y.nifterName}</span>
                        {y.nifterNameHe && <span className="he block font-hebrew text-xs text-gold-700">{y.nifterNameHe}</span>}
                        {y.relationship && <span className="block text-xs text-walnut-400">{y.relationship}</span>}
                      </td>
                      <td className="text-xs text-walnut-500">
                        {firstName ? `${firstName} ${lastName}` : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/yahrzeits?edit=${y.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        <form action={deleteYahrzeitAction} className="mt-1">
                          <input type="hidden" name="id" value={y.id} />
                          <input type="hidden" name="returnTo" value="/admin/yahrzeits" />
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

        <Card title={editing ? 'Edit yahrzeit' : 'Record a yahrzeit'}>
          <form action={saveYahrzeitAction} className="space-y-3" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="returnTo" value="/admin/yahrzeits" />
            <div>
              <label className="label" htmlFor="y-member">For which member</label>
              <select id="y-member" name="userId" defaultValue={editing?.userId ?? ''} className="select">
                <option value="">— My own record —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="y-name">Name of the niftar</label>
              <input id="y-name" name="nifterName" required defaultValue={editing?.nifterName} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="y-nameHe">Hebrew name</label>
              <input id="y-nameHe" name="nifterNameHe" dir="rtl" defaultValue={editing?.nifterNameHe ?? ''} className="input font-hebrew" placeholder="ר' אליעזר בן…" />
            </div>
            <div>
              <label className="label" htmlFor="y-rel">Relationship</label>
              <input id="y-rel" name="relationship" defaultValue={editing?.relationship ?? ''} className="input" placeholder="Father" />
            </div>
            <fieldset>
              <legend className="label">Hebrew date of petirah</legend>
              <div className="grid grid-cols-3 gap-2">
                <input name="hebrewDay" type="number" min={1} max={30} required defaultValue={editing?.hebrewDay ?? ''} placeholder="Day" className="input tabular-nums" aria-label="Hebrew day" />
                <select name="hebrewMonth" defaultValue={editing?.hebrewMonth ?? ''} required className="select" aria-label="Hebrew month">
                  <option value="">Month</option>
                  {HEBREW_MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input name="hebrewYear" type="number" required defaultValue={editing?.hebrewYear ?? currentHebrewYear()} placeholder="Year" className="input tabular-nums" aria-label="Hebrew year" />
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="y-greg">Civil date <span className="normal-case text-walnut-400">(for reference)</span></label>
              <input id="y-greg" name="gregorianDate" type="date" defaultValue={editing?.gregorianDate ?? ''} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-walnut-600">
              <input type="checkbox" name="showOnDisplay" defaultChecked={editing?.showOnDisplay ?? true} className="accent-gold-600" /> Show on the shul board
            </label>
            <button type="submit" className="btn-primary w-full">{editing ? 'Save' : 'Record yahrzeit'}</button>
            {editing && <a href="/admin/yahrzeits" className="btn-ghost w-full">Cancel</a>}
          </form>
        </Card>
      </div>
    </>
  );
}
