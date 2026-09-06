import { asc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { minyanim, shiurim } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getDaySchedule } from '@/lib/schedule';
import { todayISO, fmtTime, DAY_TYPE_LABELS, ANCHOR_LABELS } from '@/lib/zmanim';
import { saveMinyanAction, deleteMinyanAction, saveShiurAction, deleteShiurAction } from '@/actions/content';
import { PageHeader, Card, Badge, Empty, Flash } from '@/components/ui';

export const dynamic = 'force-dynamic';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];
const ANCHORS = Object.keys(ANCHOR_LABELS);
const DAY_TYPES = Object.keys(DAY_TYPE_LABELS);

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; minyan?: string; shiur?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const today = todayISO(tz);

  const [allMinyanim, allShiurim, preview] = await Promise.all([
    db.select().from(minyanim).orderBy(asc(minyanim.sortOrder), asc(minyanim.name)),
    db.select().from(shiurim).orderBy(asc(shiurim.sortOrder), asc(shiurim.title)),
    getDaySchedule(today, settings),
  ]);

  const editMinyan = sp.minyan ? allMinyanim.find((m) => m.id === Number(sp.minyan)) : undefined;
  const editShiur = sp.shiur ? allShiurim.find((s) => s.id === Number(sp.shiur)) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="The luach"
        title="Davening &amp; Shiurim"
        subtitle="A time can be fixed on the clock, or pegged to a zman so it drifts with the year on its own — “Mincha 20 minutes before shkia, rounded down to the nearest 5”."
      />

      <Flash ok={sp.ok} error={sp.error} />

      {/* Today's resolved times, so a gabbai can see the rules landing correctly. */}
      <Card className="mb-6" title="What today resolves to" action={<span className="text-xs text-walnut-400">{today}</span>}>
        {preview.minyanim.length === 0 && preview.shiurim.length === 0 ? (
          <Empty>Nothing scheduled for today.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {preview.minyanim.map((m) => (
              <span key={`m${m.id}`} className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm">
                <strong className="text-walnut-800">{m.name}</strong>{' '}
                <span className="font-semibold tabular-nums text-gold-800">{fmtTime(m.at, tz)}</span>
                {m.rule && <span className="ml-1.5 text-xs text-walnut-400">({m.rule})</span>}
              </span>
            ))}
            {preview.shiurim.map((s) => (
              <span key={`s${s.id}`} className="rounded-lg border border-walnut-200 bg-walnut-50 px-3 py-1.5 text-sm">
                <strong className="text-walnut-800">{s.title}</strong>{' '}
                <span className="font-semibold tabular-nums text-walnut-600">{fmtTime(s.at, tz)}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- Minyanim ---------------- */}
        <div className="space-y-6">
          <Card title="Minyanim">
            {allMinyanim.length === 0 ? (
              <Empty>No minyanim yet.</Empty>
            ) : (
              <table className="table-shul">
                <thead><tr><th>Name</th><th>Days</th><th>Time</th><th></th></tr></thead>
                <tbody>
                  {allMinyanim.map((m) => (
                    <tr key={m.id} className={m.active ? '' : 'opacity-50'}>
                      <td>
                        <span className="font-medium text-walnut-800">{m.name}</span>
                        {!m.active && <Badge value="disabled" label="off" />}
                        {m.location && <span className="block text-xs text-walnut-400">{m.location}</span>}
                      </td>
                      <td className="text-xs text-walnut-500">{DAY_TYPE_LABELS[m.dayType] ?? m.dayType}</td>
                      <td className="whitespace-nowrap text-sm font-semibold tabular-nums text-walnut-700">
                        {m.timeType === 'fixed'
                          ? DateTime.fromFormat(m.fixedTime ?? '', 'HH:mm').toFormat('h:mm a')
                          : `${m.offsetMinutes > 0 ? '+' : ''}${m.offsetMinutes}m ${ANCHOR_LABELS[m.relativeTo ?? 'sunset']}`}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/schedule?minyan=${m.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        <form action={deleteMinyanAction} className="mt-1">
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editMinyan ? `Edit ${editMinyan.name}` : 'Add a minyan'}>
            <form action={saveMinyanAction} className="grid gap-3 sm:grid-cols-2" key={editMinyan?.id ?? 'new-m'}>
              {editMinyan && <input type="hidden" name="id" value={editMinyan.id} />}
              <div>
                <label className="label" htmlFor="m-name">Name</label>
                <input id="m-name" name="name" required defaultValue={editMinyan?.name} className="input" placeholder="Shacharis" />
              </div>
              <div>
                <label className="label" htmlFor="m-nameHe">Hebrew</label>
                <input id="m-nameHe" name="nameHe" dir="rtl" defaultValue={editMinyan?.nameHe ?? ''} className="input font-hebrew" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="m-day">Which days</label>
                <select id="m-day" name="dayType" defaultValue={editMinyan?.dayType ?? 'weekday'} className="select">
                  {DAY_TYPES.map((d) => <option key={d} value={d}>{DAY_TYPE_LABELS[d]}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="m-type">Time is…</label>
                <select id="m-type" name="timeType" defaultValue={editMinyan?.timeType ?? 'fixed'} className="select">
                  <option value="fixed">Fixed on the clock</option>
                  <option value="relative">Relative to a zman</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-fixed">Fixed time</label>
                <input id="m-fixed" name="fixedTime" type="time" defaultValue={editMinyan?.fixedTime ?? '07:00'} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="m-anchor">Relative to</label>
                <select id="m-anchor" name="relativeTo" defaultValue={editMinyan?.relativeTo ?? 'sunset'} className="select">
                  {ANCHORS.map((a) => <option key={a} value={a}>{ANCHOR_LABELS[a]}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-offset">Offset (min)</label>
                <input id="m-offset" name="offsetMinutes" type="number" defaultValue={editMinyan?.offsetMinutes ?? -20} className="input tabular-nums" />
                <p className="mt-1 text-xs text-walnut-400">Negative = before.</p>
              </div>
              <div>
                <label className="label" htmlFor="m-round">Round to (min)</label>
                <input id="m-round" name="roundTo" type="number" min={0} max={30} defaultValue={editMinyan?.roundTo ?? 0} className="input tabular-nums" />
              </div>
              <div>
                <label className="label" htmlFor="m-dir">Rounding</label>
                <select id="m-dir" name="roundDirection" defaultValue={editMinyan?.roundDirection ?? 'earlier'} className="select">
                  <option value="earlier">Down (earlier)</option>
                  <option value="later">Up (later)</option>
                  <option value="nearest">Nearest</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-loc">Location</label>
                <input id="m-loc" name="location" defaultValue={editMinyan?.location ?? 'Main Shul'} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="m-sort">Order</label>
                <input id="m-sort" name="sortOrder" type="number" defaultValue={editMinyan?.sortOrder ?? 0} className="input tabular-nums" />
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="active" defaultChecked={editMinyan?.active ?? true} className="accent-gold-600" /> Active
                </label>
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="showOnDisplay" defaultChecked={editMinyan?.showOnDisplay ?? true} className="accent-gold-600" /> Show on the shul board
                </label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="btn-primary flex-1">{editMinyan ? 'Save' : 'Add minyan'}</button>
                {editMinyan && <a href="/admin/schedule" className="btn-ghost">Cancel</a>}
              </div>
            </form>
          </Card>
        </div>

        {/* ---------------- Shiurim ---------------- */}
        <div className="space-y-6">
          <Card title="Shiurim">
            {allShiurim.length === 0 ? (
              <Empty>No shiurim yet.</Empty>
            ) : (
              <table className="table-shul">
                <thead><tr><th>Title</th><th>When</th><th>Time</th><th></th></tr></thead>
                <tbody>
                  {allShiurim.map((s) => (
                    <tr key={s.id} className={s.active ? '' : 'opacity-50'}>
                      <td>
                        <span className="font-medium text-walnut-800">{s.title}</span>
                        {s.maggidShiur && <span className="block text-xs text-walnut-400">{s.maggidShiur}</span>}
                      </td>
                      <td className="text-xs text-walnut-500">
                        {s.recurrence === 'daily' ? 'Daily' : s.recurrence === 'weekly' && s.dayOfWeek != null ? DOW[s.dayOfWeek] : s.specificDate || '—'}
                      </td>
                      <td className="whitespace-nowrap text-sm font-semibold tabular-nums text-walnut-700">
                        {s.timeType === 'fixed'
                          ? DateTime.fromFormat(s.startTime ?? '', 'HH:mm').toFormat('h:mm a')
                          : `${s.offsetMinutes > 0 ? '+' : ''}${s.offsetMinutes}m ${ANCHOR_LABELS[s.relativeTo ?? 'sunset']}`}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/schedule?shiur=${s.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        <form action={deleteShiurAction} className="mt-1">
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editShiur ? `Edit ${editShiur.title}` : 'Add a shiur'}>
            <form action={saveShiurAction} className="grid gap-3 sm:grid-cols-2" key={editShiur?.id ?? 'new-s'}>
              {editShiur && <input type="hidden" name="id" value={editShiur.id} />}
              <div>
                <label className="label" htmlFor="s-title">Title</label>
                <input id="s-title" name="title" required defaultValue={editShiur?.title} className="input" placeholder="Daf Yomi" />
              </div>
              <div>
                <label className="label" htmlFor="s-titleHe">Hebrew</label>
                <input id="s-titleHe" name="titleHe" dir="rtl" defaultValue={editShiur?.titleHe ?? ''} className="input font-hebrew" />
              </div>
              <div>
                <label className="label" htmlFor="s-maggid">Maggid shiur</label>
                <input id="s-maggid" name="maggidShiur" defaultValue={editShiur?.maggidShiur ?? ''} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-loc">Location</label>
                <input id="s-loc" name="location" defaultValue={editShiur?.location ?? 'Beis Medrash'} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-rec">Repeats</label>
                <select id="s-rec" name="recurrence" defaultValue={editShiur?.recurrence ?? 'weekly'} className="select">
                  <option value="daily">Every day</option>
                  <option value="weekly">Weekly</option>
                  <option value="once">One off</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="s-dow">Day of week</label>
                <select id="s-dow" name="dayOfWeek" defaultValue={editShiur?.dayOfWeek ?? ''} className="select">
                  <option value="">— n/a —</option>
                  {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="s-date">Specific date <span className="normal-case text-walnut-400">(one-off only)</span></label>
                <input id="s-date" name="specificDate" type="date" defaultValue={editShiur?.specificDate ?? ''} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="s-type">Time is…</label>
                <select id="s-type" name="timeType" defaultValue={editShiur?.timeType ?? 'fixed'} className="select">
                  <option value="fixed">Fixed on the clock</option>
                  <option value="relative">Relative to a zman</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="s-start">Fixed time</label>
                <input id="s-start" name="startTime" type="time" defaultValue={editShiur?.startTime ?? '20:00'} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="s-dur">Length (min)</label>
                <input id="s-dur" name="durationMinutes" type="number" defaultValue={editShiur?.durationMinutes ?? 45} className="input tabular-nums" />
              </div>
              <div>
                <label className="label" htmlFor="s-anchor">Relative to</label>
                <select id="s-anchor" name="relativeTo" defaultValue={editShiur?.relativeTo ?? 'sunset'} className="select">
                  {ANCHORS.map((a) => <option key={a} value={a}>{ANCHOR_LABELS[a]}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="s-offset">Offset (min)</label>
                <input id="s-offset" name="offsetMinutes" type="number" defaultValue={editShiur?.offsetMinutes ?? 0} className="input tabular-nums" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="s-desc">Description</label>
                <textarea id="s-desc" name="description" defaultValue={editShiur?.description ?? ''} className="textarea" />
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="active" defaultChecked={editShiur?.active ?? true} className="accent-gold-600" /> Active
                </label>
                <label className="flex items-center gap-2 text-sm text-walnut-600">
                  <input type="checkbox" name="showOnDisplay" defaultChecked={editShiur?.showOnDisplay ?? true} className="accent-gold-600" /> Show on the shul board
                </label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="btn-primary flex-1">{editShiur ? 'Save' : 'Add shiur'}</button>
                {editShiur && <a href="/admin/schedule" className="btn-ghost">Cancel</a>}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
