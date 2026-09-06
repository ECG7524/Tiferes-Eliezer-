import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { UPLOAD_DIR, SAFE_NAME } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Serves an uploaded flyer. These cannot live in `public/` — that directory is
 * resolved from a build-time manifest, so a file uploaded after the build is
 * never found there.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  // The only names that exist are the ones saveFlyer generated, so anything
  // else is either a typo or an attempt to walk out of the directory.
  if (!SAFE_NAME.test(file)) {
    return new Response('Not found', { status: 404 });
  }

  const path = join(UPLOAD_DIR, file);

  try {
    const info = await stat(path);
    if (!info.isFile()) return new Response('Not found', { status: 404 });

    const body = await readFile(path);
    const ext = file.split('.').pop()!;

    return new Response(body, {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': String(info.size),
        // The filename carries a timestamp and random suffix, so a given URL
        // always refers to the same bytes and can be cached hard.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
