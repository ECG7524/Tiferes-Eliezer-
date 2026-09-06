'use client';

import { useEffect, useRef, useState } from 'react';
import { CrestMark } from './CrestMark';

/**
 * The shul's crest, from the brand kit in `public/brand/`.
 *
 * Each variant names the resolution it needs rather than always taking the
 * largest file: the header shows the crest at about 50px tall, the board at
 * 130px on a television, and the homepage the full plate at around 560px.
 * Anything missing falls back down the chain, and finally to the drawn mark,
 * so a page never shows a broken image.
 */
export type CrestVariant = 'full' | 'mark' | 'mark-light';

const BRAND = '/brand';

/** Preference order per variant: the first file that loads wins. */
const SOURCES: Record<CrestVariant, string[]> = {
  // The whole plate — crest, dedication, nasi line and address.
  full: [`${BRAND}/kte-logo-primary@2x.png`, `${BRAND}/kte-logo-primary.png`],
  // Crest only, for the site header and footer.
  mark: [`${BRAND}/kte-crest-mark.png`, `${BRAND}/kte-logo-primary.png`],
  // Crest only at the size the shul monitor needs it.
  'mark-light': [`${BRAND}/kte-crest-mark@3x.png`, `${BRAND}/kte-crest-mark.png`],
};

const HEIGHTS = {
  xs: 'h-9',
  sm: 'h-12',
  md: 'h-20',
  /** Sized for the board's header band. */
  board: 'h-[132px]',
  lg: 'h-32 sm:h-44',
  xl: 'h-40 sm:h-56',
} as const;

const WORDMARK_HE = {
  xs: 'text-base', sm: 'text-lg', md: 'text-2xl', board: 'text-4xl',
  lg: 'text-4xl sm:text-5xl', xl: 'text-5xl sm:text-6xl',
} as const;

const WORDMARK_EN = {
  xs: 'text-[9px]', sm: 'text-[10px]', md: 'text-xs', board: 'text-sm',
  lg: 'text-sm', xl: 'text-base',
} as const;

export function Crest({
  variant = 'mark',
  size = 'md',
  className = '',
  nameHe = 'קהל תפארת אליעזר',
  nameEn = 'Kehal Tiferes Eliezer',
  dark = false,
}: {
  variant?: CrestVariant;
  size?: keyof typeof HEIGHTS;
  className?: string;
  nameHe?: string;
  nameEn?: string;
  /** Colours the typographic fallback for a dark background. */
  dark?: boolean;
}) {
  const chain = SOURCES[variant];
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // A file that 404s during server-rendered HTML has already failed before
  // React attaches onError, so check the settled image once on mount too.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setAttempt((a) => a + 1);
  }, [attempt]);

  const src = chain[attempt];

  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={`${nameEn} — ${nameHe}`}
        onError={() => setAttempt((a) => a + 1)}
        className={`${HEIGHTS[size]} w-auto object-contain ${className}`}
      />
    );
  }

  // No artwork in public/ yet, so use the drawn crest. It carries the shul's
  // name in a cartouche rather than leaving a gap, and steps aside as soon as
  // the real files are added.
  return (
    <span className={`inline-flex ${HEIGHTS[size]} items-center ${className}`}>
      <CrestMark nameHe={nameHe} dark={dark} />
    </span>
  );
}
