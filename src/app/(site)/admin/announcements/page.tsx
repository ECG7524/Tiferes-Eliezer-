import { desc, asc, gte } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db';
import { announcements, events } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { saveAnnouncementAction, deleteAnnouncementAction, saveEventAction, deleteEventAction } from '@/actions/content';
import { PageHeader, Card, Badge, Empty, Flash } from '@/components/ui';
import { flyerUrl } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

/** `datetime-local` wants `yyyy-MM-dd'T'HH:mm` in the shul's own timezone. */
function toLocalInput(unix: number | null | undefined, tz: string): string {
  if (!unix) return '';
  return DateTime.fromSeconds(unix, { zone: tz }).toFormat("yyyy-LL-dd'T'HH:mm");
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string; event?: string }>;
}) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const tz = settings.timezone;
  const now = Math.floor(Date.now() / 1000);

  const [rows, eventRows] = await Promise.all([
    db.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.publishAt)).limit(100),
    db.select().from(events).where(gte(events.startAt, now - 86400 * 30)).orderBy(asc(events.startAt)).limit(50),
  ]);

  const editing = sp.edit ? rows.find((r) => r.id === Number(sp.edit)) : undefined;
  const editingEvent = sp.event ? eventRows.find((r) => r.id === Number(sp.event)) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Notices"
        title="Announcements"
        titleHe="הודעות"
        subtitle="What appears on the homepage, in members' accounts and on the shul monitor. An expiry date means nobody has to remember to take it down."
      />

      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Current &amp; past notices">
            {rows.length === 0 ? (
              <Empty>Nothing posted yet.</Empty>
            ) : (
              <ul className="divide-y divide-gold-100">
                {rows.map((a) => {
                  const live = a.publishAt <= now && (!a.expiresAt || a.expiresAt >= now);
                  return (
                    <li key={a.id} className={`py-3 first:pt-0 last:pb-0 ${live ? '' : 'opacity-50'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-walnut-800">{a.title}</h3>
                            {a.priority !== 'normal' && <Badge value={a.priority} />}
                            {a.pinned && <Badge value="high" label="pinned" />}
                            {a.audience === 'members' && <Badge value="member" label="members only" />}
                            {!live && <Badge value="disabled" label={a.publishAt > now ? 'scheduled' : 'expired'} />}
                          </div>
                          {a.body && <p className="mt-1 line-clamp-2 text-xs text-walnut-500">{a.body}</p>}
                          {a.imageFile && (
                            <span className="mt-1.5 inline-flex items-center gap-2 text-[11px] text-gold-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={flyerUrl(a.imageFile)!} alt="" className="h-10 w-auto rounded border border-gold-300" />
                              flyer attached
                            </span>
                          )}
                          <p className="mt-1 text-[11px] text-walnut-400">
                            {DateTime.fromSeconds(a.publishAt, { zone: tz }).toFormat('LLL d, yyyy h:mm a')}
                            {a.expiresAt && ` → ${DateTime.fromSeconds(a.expiresAt, { zone: tz }).toFormat('LLL d, yyyy')}`}
                            {a.showOnDisplay && ' · on the shul board'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <a href={`/admin/announcements?edit=${a.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                          <form action={deleteAnnouncementAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                          </form>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Upcoming events">
            {eventRows.length === 0 ? (
              <Empty>No events on the calendar.</Empty>
            ) : (
              <table className="table-shul">
                <thead><tr><th>When</th><th>Event</th><th>Where</th><th></th></tr></thead>
                <tbody>
                  {eventRows.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-walnut-600">
                        {DateTime.fromSeconds(e.startAt, { zone: tz }).toFormat('LLL d, h:mm a')}
                      </td>
                      <td className="font-medium text-walnut-800">{e.title}</td>
                      <td className="text-xs text-walnut-500">{e.location || '—'}</td>
                      <td className="whitespace-nowrap text-right">
                        <a href={`/admin/announcements?event=${e.id}`} className="text-xs font-semibold text-gold-700 hover:underline">Edit</a>
                        <form action={deleteEventAction} className="mt-1">
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-xs text-walnut-400 hover:text-rose-600 hover:underline">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={editing ? 'Edit notice' : 'Post a notice'}>
            <form action={saveAnnouncementAction} className="space-y-3" key={editing?.id ?? 'new'}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <div>
                <label className="label" htmlFor="a-title">Title</label>
                <input id="a-title" name="title" required defaultValue={editing?.title} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="a-body">Body</label>
                <textarea id="a-body" name="body" rows={4} defaultValue={editing?.body ?? ''} className="textarea" />
              </div>

              {/* ---- Flyer ---- */}
              <div className="rounded-lg border border-gold-200 bg-gold-50/40 p-3">
                <label className="label" htmlFor="a-image">
                  Flyer <span className="normal-case text-walnut-400">(optional)</span>
                </label>
                {editing?.imageFile && (
                  <div className="mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={flyerUrl(editing.imageFile)!}
                      alt=""
                      className="max-h-48 w-auto rounded border border-gold-300"
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs text-walnut-600">
                      <input type="checkbox" name="removeImage" className="accent-gold-600" />
                      Remove this flyer
                    </label>
                  </div>
                )}
                <input
                  id="a-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="w-full text-xs text-walnut-600 file:mr-3 file:rounded file:border-0 file:bg-walnut-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ivory-50"
                />
                <p className="mt-1.5 text-xs text-walnut-400">
                  JPG, PNG or WEBP, up to 8MB. On the shul board the flyer fills the panel, so the
                  title and body are used only on the website.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="a-pri">Priority</label>
                  <select id="a-pri" name="priority" defaultValue={editing?.priority ?? 'normal'} className="select">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="a-aud">Audience</label>
                  <select id="a-aud" name="audience" defaultValue={editing?.audience ?? 'public'} className="select">
                    <option value="public">Everyone</option>
                    <option value="members">Members only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="a-pub">Publish at</label>
                <input id="a-pub" name="publishAt" type="datetime-local" defaultValue={toLocalInput(editing?.publishAt, tz)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="a-exp">Expires <span className="normal-case text-walnut-400">(optional)</span></label>
                <input id="a-exp" name="expiresAt" type="datetime-local" defaultValue={toLocalInput(editing?.expiresAt, tz)} className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="pinned" defaultChecked={editing?.pinned ?? false} className="accent-gold-600" /> Pin to the top
              </label>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="showOnDisplay" defaultChecked={editing?.showOnDisplay ?? true} className="accent-gold-600" /> Show on the shul board
              </label>
              <button type="submit" className="btn-primary w-full">{editing ? 'Save' : 'Post notice'}</button>
              {editing && <a href="/admin/announcements" className="btn-ghost w-full">Cancel</a>}
            </form>
          </Card>

          <Card title={editingEvent ? 'Edit event' : 'Add an event'}>
            <form action={saveEventAction} className="space-y-3" key={editingEvent?.id ?? 'new-e'}>
              {editingEvent && <input type="hidden" name="id" value={editingEvent.id} />}
              <div>
                <label className="label" htmlFor="e-title">Title</label>
                <input id="e-title" name="title" required defaultValue={editingEvent?.title} className="input" placeholder="Melava Malka" />
              </div>
              <div>
                <label className="label" htmlFor="e-start">Starts</label>
                <input id="e-start" name="startAt" type="datetime-local" required defaultValue={toLocalInput(editingEvent?.startAt, tz)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="e-end">Ends</label>
                <input id="e-end" name="endAt" type="datetime-local" defaultValue={toLocalInput(editingEvent?.endAt, tz)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="e-loc">Location</label>
                <input id="e-loc" name="location" defaultValue={editingEvent?.location ?? ''} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="e-desc">Description</label>
                <textarea id="e-desc" name="description" rows={2} defaultValue={editingEvent?.description ?? ''} className="textarea" />
              </div>
              <label className="flex items-center gap-2 text-sm text-walnut-600">
                <input type="checkbox" name="showOnDisplay" defaultChecked={editingEvent?.showOnDisplay ?? true} className="accent-gold-600" /> Show on the shul board
              </label>
              <button type="submit" className="btn-ghost w-full">{editingEvent ? 'Save' : 'Add event'}</button>
              {editingEvent && <a href="/admin/announcements" className="btn-ghost w-full">Cancel</a>}
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
