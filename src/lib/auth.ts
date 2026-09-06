import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '@/db';
import { users, sessions, type User } from '@/db/schema';

const COOKIE = 'te_session';
const SESSION_DAYS = 30;

export type Role = 'member' | 'gabbai' | 'admin';

/** Gabbaim can run the shul's day-to-day modules; admins can also touch people and settings. */
const RANK: Record<Role, number> = { member: 1, gabbai: 2, admin: 3 };

export function atLeast(user: User | null, role: Role): boolean {
  if (!user || user.status !== 'active') return false;
  return RANK[user.role as Role] >= RANK[role];
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Session ids are random and stored hashed, so a leaked database row can't be
 * replayed as a live cookie.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

/** The signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, nowSec)))
    .limit(1);

  const user = rows[0]?.user ?? null;
  // A member who was disabled after signing in should stop being "logged in".
  if (user && user.status !== 'active') return null;
  return user;
}

/** Housekeeping so the sessions table doesn't grow without bound. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, Math.floor(Date.now() / 1000)));
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!atLeast(user, role)) throw new Error('FORBIDDEN');
  return user!;
}
