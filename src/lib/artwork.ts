import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The brand-kit files the site actually loads, and where each appears. */
export const ARTWORK: { file: string; label: string; usedFor: string }[] = [
  { file: 'kte-logo-primary@2x.png', label: 'Full plate', usedFor: 'Homepage, login and sign-up' },
  { file: 'kte-crest-mark.png', label: 'Crest only', usedFor: 'Site header and footer' },
  { file: 'kte-crest-mark@3x.png', label: 'Crest, large', usedFor: 'The shul display board' },
  { file: 'kte-icon-192.png', label: 'Square icon', usedFor: 'Browser tab and phone home screens' },
];

/**
 * Which artwork files are actually present. Returns null when the filesystem
 * cannot be inspected — some hosts serve `public/` from a bundle rather than
 * from disk, and a wrong "missing" answer would be worse than none.
 */
export function artworkPresence(): Record<string, boolean> | null {
  try {
    const dir = join(process.cwd(), 'public', 'brand');
    if (!existsSync(dir)) return null;
    return Object.fromEntries(ARTWORK.map((a) => [a.file, existsSync(join(dir, a.file))]));
  } catch {
    return null;
  }
}
