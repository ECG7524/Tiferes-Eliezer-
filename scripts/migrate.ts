import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@libsql/client';

/**
 * Applies every SQL file in drizzle/ that hasn't run yet. Deliberately plain:
 * a shul server should be able to update itself with `npm run db:migrate`
 * and no extra tooling.
 */
async function main() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./data/shul.db';
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  await client.execute(`
    create table if not exists _migrations (
      name text primary key,
      applied_at integer not null default (unixepoch())
    )
  `);

  const applied = new Set(
    (await client.execute('select name from _migrations')).rows.map((r) => String(r.name)),
  );

  const dir = join(process.cwd(), 'drizzle');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(join(dir, file), 'utf8');
    // drizzle-kit separates statements with this marker.
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.execute(statement);
    }

    await client.execute({ sql: 'insert into _migrations (name) values (?)', args: [file] });
    console.log(`  applied ${file}`);
    ran++;
  }

  console.log(ran === 0 ? 'Database already up to date.' : `Applied ${ran} migration(s).`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
