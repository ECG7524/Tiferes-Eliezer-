import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * One client for the whole app. Point it at a local file for a single-server
 * deployment, or at Turso (libsql://…) when hosting somewhere serverless.
 */
const url = process.env.TURSO_DATABASE_URL || 'file:./data/shul.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __shulClient?: ReturnType<typeof createClient> };

export const client = globalForDb.__shulClient ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== 'production') globalForDb.__shulClient = client;

export const db = drizzle(client, { schema });
export { schema };
