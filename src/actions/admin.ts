'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { requireRole, requireUser, hashPassword, verifyPassword } from '@/lib/auth';
import { updateSettings } from '@/lib/settings';

function fail(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

/* ---------------- Members ---------------- */

export async function updateMemberAction(formData: FormData) {
  const admin = await requireRole('admin');
  const id = Number(formData.get('id'));
  if (!id) fail('/admin/members', 'No member selected.');

  const role = String(formData.get('role') ?? 'member') as 'member' | 'gabbai' | 'admin';
  const status = String(formData.get('status') ?? 'active') as 'pending' | 'active' | 'disabled';

  // Never let the last administrator lock themselves — or everyone — out.
  if (id === admin.id && (role !== 'admin' || status !== 'active')) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.role} = 'admin' and ${users.status} = 'active'`);
    if (Number(count) <= 1) {
      fail('/admin/members', 'You are the only active administrator — promote somebody else first.');
    }
  }

  await db
    .update(users)
    .set({
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      hebrewName: String(formData.get('hebrewName') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      role,
      status,
      notes: String(formData.get('notes') ?? '').trim(),
    })
    .where(eq(users.id, id));

  // Someone who has just been disabled should not stay signed in.
  if (status !== 'active') await db.delete(sessions).where(eq(sessions.userId, id));

  revalidatePath('/admin/members');
  redirect('/admin/members?ok=' + encodeURIComponent('Member updated.'));
}

export async function approveMemberAction(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('id'));
  if (id) await db.update(users).set({ status: 'active' }).where(eq(users.id, id));
  revalidatePath('/admin/members');
  redirect('/admin/members?ok=' + encodeURIComponent('Member approved.'));
}

export async function resetMemberPasswordAction(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('id'));
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) fail('/admin/members', 'A new password must be at least 8 characters.');

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, id));
  // Force a fresh login everywhere with the new password.
  await db.delete(sessions).where(eq(sessions.userId, id));

  revalidatePath('/admin/members');
  redirect('/admin/members?ok=' + encodeURIComponent('Password reset. Pass the new one on to the member directly.'));
}

/* ---------------- Own profile ---------------- */

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  await db
    .update(users)
    .set({
      firstName: String(formData.get('firstName') ?? '').trim() || user.firstName,
      lastName: String(formData.get('lastName') ?? '').trim() || user.lastName,
      hebrewName: String(formData.get('hebrewName') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/account');
  redirect('/account?ok=' + encodeURIComponent('Your details have been saved.'));
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');

  if (!(await verifyPassword(current, user.passwordHash))) {
    fail('/account', 'Your current password was not correct.');
  }
  if (next.length < 8) fail('/account', 'Choose a new password of at least 8 characters.');
  if (next !== String(formData.get('confirmPassword') ?? '')) {
    fail('/account', 'The two new passwords did not match.');
  }

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));

  revalidatePath('/account');
  redirect('/account?ok=' + encodeURIComponent('Your password has been changed.'));
}

/* ---------------- Settings ---------------- */

export async function saveSettingsAction(formData: FormData) {
  await requireRole('admin');

  const num = (key: string, fallback: number) => {
    const v = Number(formData.get(key));
    return Number.isFinite(v) ? v : fallback;
  };
  const str = (key: string) => String(formData.get(key) ?? '').trim();
  const money = (key: string, fallback: number) => {
    const v = Number(String(formData.get(key) ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : fallback;
  };

  const latitude = num('latitude', 40.0334);
  const longitude = num('longitude', -74.2129);
  if (latitude < -90 || latitude > 90) fail('/admin/settings', 'Latitude must be between -90 and 90.');
  if (longitude < -180 || longitude > 180) fail('/admin/settings', 'Longitude must be between -180 and 180.');

  try {
    // Reject a timezone the zmanim engine could not use.
    new Intl.DateTimeFormat('en-US', { timeZone: str('timezone') });
  } catch {
    fail('/admin/settings', 'That is not a recognised timezone. Use a name like America/New_York.');
  }

  await updateSettings({
    nameHe: str('nameHe'),
    nameEn: str('nameEn'),
    dedicationHe: str('dedicationHe'),
    nasiHe: str('nasiHe'),
    addressLine: str('addressLine'),
    city: str('city'),
    state: str('state'),
    zip: str('zip'),
    phone: str('phone'),
    email: str('email'),
    latitude,
    longitude,
    elevation: num('elevation', 12),
    timezone: str('timezone'),
    candleLightingMinutes: num('candleLightingMinutes', 18),
    havdalahMinutes: num('havdalahMinutes', 50),
    tzaisOpinion: str('tzaisOpinion') as 'geonim_8_5',
    alosOpinion: str('alosOpinion') as 'degrees_16_1',
    inIsrael: formData.get('inIsrael') === 'on',
    defaultKiddushCents: money('defaultKiddushCents', 36000),
    defaultShaloshSeudosCents: money('defaultShaloshSeudosCents', 18000),
    defaultSeatCents: money('defaultSeatCents', 50000),
    defaultAliyahCents: money('defaultAliyahCents', 3600),
    displayRotateSeconds: Math.min(120, Math.max(5, num('displayRotateSeconds', 20))),
    displayShowYahrzeits: formData.get('displayShowYahrzeits') === 'on',
    displayShowSponsors: formData.get('displayShowSponsors') === 'on',
    displayShowDaf: formData.get('displayShowDaf') === 'on',
    displayMessage: str('displayMessage'),
    requireApproval: formData.get('requireApproval') === 'on',
  });

  revalidatePath('/', 'layout');
  redirect('/admin/settings?ok=' + encodeURIComponent('Settings saved.'));
}
