import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The crest files the site looks for, and what each is used for. */
export const ARTWORK: { file: string; label: string; usedFor: string }[] = [
  { file: 'logo-full.png', label: 'Full crest', usedFor: 'Homepage, login and sign-up' },
  { file: 'logo-mark.png', label: 'Crest only', usedFor: 'Site header and footer' },
  { file: 'logo-mark-light.png', label: 'Crest, light gold', usedFor: 'The shul display board' },
  { file: 'icon.png', label: 'Square icon', usedFor: 'Browser tab and phone home screens' },
];

/**
 * Which artwork files are actually present. Returns null when the filesystem
 * cannot be inspected — some hosts serve `public/` from a bundle rather than
 * from disk, and a wrong "missing" answer would be worse than none.
 */
export function artworkPresence(): Record<string, boolean> | null {
  try {
    const dir = join(process.cwd(), 'public');
    if (!existsSync(dir)) return null;
    return Object.fromEntries(ARTWORK.map((a) => [a.file, existsSync(join(dir, a.file))]));
  } catch {
    return null;
  }
}
