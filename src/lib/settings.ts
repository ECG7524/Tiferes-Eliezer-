import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings, type Settings } from '@/db/schema';

/**
 * Settings are a single row. If the shul has never saved any, we insert the
 * defaults baked into the schema so the site works on a cold database.
 */
export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (rows[0]) return rows[0];

  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const created = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return created[0];
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await getSettings();
  await db
    .update(settings)
    .set({ ...patch, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(settings.id, 1));
}
