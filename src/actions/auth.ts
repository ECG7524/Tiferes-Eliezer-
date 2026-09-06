'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession, destroySession, hashPassword, verifyPassword, pruneExpiredSessions } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

const emailSchema = z.string().trim().toLowerCase().email('Please enter a valid email address.');

function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function loginAction(formData: FormData) {
  const emailRaw = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/account');

  const parsed = emailSchema.safeParse(emailRaw);
  if (!parsed.success) back('/login', parsed.error.errors[0].message);
  if (!password) back('/login', 'Please enter your password.');

  const rows = await db.select().from(users).where(eq(users.email, parsed.data)).limit(1);
  const user = rows[0];

  // Same message either way, so this can't be used to discover who has an account.
  const GENERIC = 'That email and password combination was not recognised.';
  if (!user) back('/login', GENERIC);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) back('/login', GENERIC);

  if (user.status === 'pending') {
    back('/login', 'Your account is waiting for approval by the shul office. You will be able to log in once it is approved.');
  }
  if (user.status === 'disabled') {
    back('/login', 'This account has been deactivated. Please contact the shul office.');
  }

  await pruneExpiredSessions();
  await createSession(user.id);
  redirect(next.startsWith('/') ? next : '/account');
}

export async function registerAction(formData: FormData) {
  const settings = await getSettings();

  const schema = z.object({
    firstName: z.string().trim().min(1, 'Please enter your first name.'),
    lastName: z.string().trim().min(1, 'Please enter your last name.'),
    email: emailSchema,
    phone: z.string().trim().optional().default(''),
    hebrewName: z.string().trim().optional().default(''),
    password: z.string().min(8, 'Choose a password of at least 8 characters.'),
  });

  const parsed = schema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    hebrewName: formData.get('hebrewName') ?? '',
    password: formData.get('password'),
  });

  if (!parsed.success) back('/register', parsed.error.errors[0].message);
  const data = parsed.data;

  if (data.password !== String(formData.get('confirmPassword') ?? '')) {
    back('/register', 'The two passwords did not match.');
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing[0]) back('/register', 'There is already an account with that email address. Try logging in instead.');

  // The very first person to sign up becomes the administrator, otherwise
  // there would be no way into the admin console on a fresh install.
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  const isFirst = anyUser.length === 0;

  const [created] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
      hebrewName: data.hebrewName,
      phone: data.phone,
      role: isFirst ? 'admin' : 'member',
      status: isFirst || !settings.requireApproval ? 'active' : 'pending',
    })
    .returning();

  if (created.status === 'active') {
    await createSession(created.id);
    redirect('/account?ok=' + encodeURIComponent('Welcome! Your account is ready.'));
  }

  redirect('/login?ok=' + encodeURIComponent('Thank you. Your account has been created and is waiting for approval by the shul office.'));
}

export async function logoutAction() {
  await destroySession();
  redirect('/');
}
