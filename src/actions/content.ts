'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { announcements, minyanim, shiurim, events, yahrzeits } from '@/db/schema';
import { requireRole, requireUser, getCurrentUser } from '@/lib/auth';
import { saveFlyer, deleteFlyer } from '@/lib/uploads';

function fail(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

/** Turns a `datetime-local` value into a unix timestamp, or null if blank. */
function toUnix(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/* ---------------- Announcements ---------------- */

export async function saveAnnouncementAction(formData: FormData) {
  const staff = await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const title = String(formData.get('title') ?? '').trim();
  if (!title) fail('/admin/announcements', 'Give the announcement a title.');

  const existing = id
    ? (await db.select().from(announcements).where(eq(announcements.id, id)).limit(1))[0]
    : undefined;

  // A flyer replaces whatever was there; ticking "remove" clears it.
  const upload = formData.get('image');
  const removeImage = formData.get('removeImage') === 'on';
  let image = {
    imageFile: existing?.imageFile ?? '',
    imageWidth: existing?.imageWidth ?? null,
    imageHeight: existing?.imageHeight ?? null,
  };

  if (upload instanceof File && upload.size > 0) {
    try {
      const saved = await saveFlyer(upload);
      if (existing?.imageFile) await deleteFlyer(existing.imageFile);
      image = { imageFile: saved.file, imageWidth: saved.width, imageHeight: saved.height };
    } catch (err) {
      fail('/admin/announcements', err instanceof Error ? err.message : 'That image could not be saved.');
    }
  } else if (removeImage && existing?.imageFile) {
    await deleteFlyer(existing.imageFile);
    image = { imageFile: '', imageWidth: null, imageHeight: null };
  }

  const values = {
    title,
    body: String(formData.get('body') ?? '').trim(),
    ...image,
    priority: String(formData.get('priority') ?? 'normal') as 'normal',
    audience: String(formData.get('audience') ?? 'public') as 'public',
    publishAt: toUnix(String(formData.get('publishAt') ?? '')) ?? Math.floor(Date.now() / 1000),
    expiresAt: toUnix(String(formData.get('expiresAt') ?? '')),
    pinned: formData.get('pinned') === 'on',
    showOnDisplay: formData.get('showOnDisplay') === 'on',
    authorId: staff.id,
  };

  if (id) {
    await db.update(announcements).set(values).where(eq(announcements.id, id));
  } else {
    await db.insert(announcements).values(values);
  }

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
  revalidatePath('/');
  redirect('/admin/announcements?ok=' + encodeURIComponent('Announcement saved.'));
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) {
    // Take the flyer off disk too, rather than orphaning it.
    const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (row?.imageFile) await deleteFlyer(row.imageFile);
    await db.delete(announcements).where(eq(announcements.id, id));
  }
  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
  redirect('/admin/announcements?ok=' + encodeURIComponent('Announcement removed.'));
}

/* ---------------- Minyanim ---------------- */

export async function saveMinyanAction(formData: FormData) {
  await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) fail('/admin/schedule', 'Give the minyan a name.');

  const timeType = String(formData.get('timeType') ?? 'fixed') as 'fixed' | 'relative';
  const fixedTime = String(formData.get('fixedTime') ?? '').trim();
  if (timeType === 'fixed' && !/^\d{1,2}:\d{2}$/.test(fixedTime)) {
    fail('/admin/schedule', 'Enter the time as HH:MM, for example 07:15.');
  }

  const values = {
    name,
    nameHe: String(formData.get('nameHe') ?? '').trim(),
    dayType: String(formData.get('dayType') ?? 'weekday') as 'weekday',
    timeType,
    fixedTime,
    relativeTo: String(formData.get('relativeTo') ?? 'sunset') as 'sunset',
    offsetMinutes: Number(formData.get('offsetMinutes')) || 0,
    roundTo: Number(formData.get('roundTo')) || 0,
    roundDirection: String(formData.get('roundDirection') ?? 'earlier') as 'earlier',
    location: String(formData.get('location') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
    active: formData.get('active') === 'on',
    showOnDisplay: formData.get('showOnDisplay') === 'on',
    sortOrder: Number(formData.get('sortOrder')) || 0,
  };

  if (id) {
    await db.update(minyanim).set(values).where(eq(minyanim.id, id));
  } else {
    await db.insert(minyanim).values(values);
  }

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
  revalidatePath('/');
  redirect('/admin/schedule?ok=' + encodeURIComponent('Minyan saved.'));
}

export async function deleteMinyanAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) await db.delete(minyanim).where(eq(minyanim.id, id));
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
  redirect('/admin/schedule?ok=' + encodeURIComponent('Minyan removed.'));
}

/* ---------------- Shiurim ---------------- */

export async function saveShiurAction(formData: FormData) {
  await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const title = String(formData.get('title') ?? '').trim();
  if (!title) fail('/admin/schedule', 'Give the shiur a title.');

  const recurrence = String(formData.get('recurrence') ?? 'weekly') as 'weekly';
  const dowRaw = String(formData.get('dayOfWeek') ?? '');

  const values = {
    title,
    titleHe: String(formData.get('titleHe') ?? '').trim(),
    maggidShiur: String(formData.get('maggidShiur') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    location: String(formData.get('location') ?? '').trim(),
    recurrence,
    dayOfWeek: dowRaw === '' ? null : Number(dowRaw),
    specificDate: String(formData.get('specificDate') ?? '').trim(),
    timeType: String(formData.get('timeType') ?? 'fixed') as 'fixed',
    startTime: String(formData.get('startTime') ?? '').trim(),
    relativeTo: String(formData.get('relativeTo') ?? 'sunset') as 'sunset',
    offsetMinutes: Number(formData.get('offsetMinutes')) || 0,
    durationMinutes: Number(formData.get('durationMinutes')) || 45,
    active: formData.get('active') === 'on',
    showOnDisplay: formData.get('showOnDisplay') === 'on',
    sortOrder: Number(formData.get('sortOrder')) || 0,
  };

  if (id) {
    await db.update(shiurim).set(values).where(eq(shiurim.id, id));
  } else {
    await db.insert(shiurim).values(values);
  }

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
  redirect('/admin/schedule?ok=' + encodeURIComponent('Shiur saved.'));
}

export async function deleteShiurAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) await db.delete(shiurim).where(eq(shiurim.id, id));
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
  redirect('/admin/schedule?ok=' + encodeURIComponent('Shiur removed.'));
}

/* ---------------- Events ---------------- */

export async function saveEventAction(formData: FormData) {
  await requireRole('gabbai');

  const id = Number(formData.get('id')) || null;
  const title = String(formData.get('title') ?? '').trim();
  const startAt = toUnix(String(formData.get('startAt') ?? ''));
  if (!title || startAt == null) fail('/admin/announcements', 'An event needs a title and a start time.');

  const values = {
    title,
    description: String(formData.get('description') ?? '').trim(),
    startAt,
    endAt: toUnix(String(formData.get('endAt') ?? '')),
    location: String(formData.get('location') ?? '').trim(),
    showOnDisplay: formData.get('showOnDisplay') === 'on',
  };

  if (id) {
    await db.update(events).set(values).where(eq(events.id, id));
  } else {
    await db.insert(events).values(values);
  }

  revalidatePath('/admin/announcements');
  redirect('/admin/announcements?ok=' + encodeURIComponent('Event saved.'));
}

export async function deleteEventAction(formData: FormData) {
  await requireRole('gabbai');
  const id = Number(formData.get('id'));
  if (id) await db.delete(events).where(eq(events.id, id));
  revalidatePath('/admin/announcements');
  redirect('/admin/announcements?ok=' + encodeURIComponent('Event removed.'));
}

/* ---------------- Yahrzeits ---------------- */

/**
 * Members keep their own yahrzeits; a gabbai can record one for anybody.
 * `returnTo` lets the same action serve the member page and the admin page.
 */
export async function saveYahrzeitAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get('returnTo') ?? '/account');

  const id = Number(formData.get('id')) || null;
  const nifterName = String(formData.get('nifterName') ?? '').trim();
  if (!nifterName) fail(returnTo, 'Enter the name of the niftar.');

  const hebrewDay = Number(formData.get('hebrewDay'));
  const hebrewMonth = Number(formData.get('hebrewMonth'));
  const hebrewYear = Number(formData.get('hebrewYear'));
  if (!hebrewDay || !hebrewMonth || !hebrewYear) {
    fail(returnTo, 'Enter the full Hebrew date of the petirah.');
  }

  // Only staff may file a yahrzeit against someone else's account.
  let ownerId = user.id;
  const requestedOwner = Number(formData.get('userId')) || null;
  if (requestedOwner && requestedOwner !== user.id) {
    if (user.role !== 'admin' && user.role !== 'gabbai') fail(returnTo, 'You can only manage your own yahrzeits.');
    ownerId = requestedOwner;
  }

  const values = {
    userId: ownerId,
    nifterName,
    nifterNameHe: String(formData.get('nifterNameHe') ?? '').trim(),
    relationship: String(formData.get('relationship') ?? '').trim(),
    hebrewDay,
    hebrewMonth,
    hebrewYear,
    gregorianDate: String(formData.get('gregorianDate') ?? '').trim(),
    showOnDisplay: formData.get('showOnDisplay') === 'on',
    notes: String(formData.get('notes') ?? '').trim(),
  };

  if (id) {
    const [existing] = await db.select().from(yahrzeits).where(eq(yahrzeits.id, id)).limit(1);
    if (!existing) fail(returnTo, 'That record no longer exists.');
    if (existing.userId !== user.id && user.role !== 'admin' && user.role !== 'gabbai') {
      fail(returnTo, 'You can only edit your own yahrzeits.');
    }
    await db.update(yahrzeits).set(values).where(eq(yahrzeits.id, id));
  } else {
    await db.insert(yahrzeits).values(values);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?ok=` + encodeURIComponent('Yahrzeit saved.'));
}

export async function deleteYahrzeitAction(formData: FormData) {
  const user = await getCurrentUser();
  const returnTo = String(formData.get('returnTo') ?? '/account');
  if (!user) fail(returnTo, 'Please log in.');

  const id = Number(formData.get('id'));
  const [row] = await db.select().from(yahrzeits).where(eq(yahrzeits.id, id)).limit(1);
  if (!row) redirect(returnTo);

  if (row.userId !== user.id && user.role !== 'admin' && user.role !== 'gabbai') {
    fail(returnTo, 'You can only remove your own yahrzeits.');
  }

  await db.delete(yahrzeits).where(eq(yahrzeits.id, id));
  revalidatePath(returnTo);
  redirect(`${returnTo}?ok=` + encodeURIComponent('Yahrzeit removed.'));
}
