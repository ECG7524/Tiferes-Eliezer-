'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The shul's crest.
 *
 * Three artwork files live in `public/`, each suited to a different setting —
 * see `public/README.md`. Any that are missing fall back down the chain to the
 * next best, and finally to a typographic wordmark, so the site never shows a
 * broken image while the artwork is still being added.
 */
export type CrestVariant = 'full' | 'mark' | 'mark-light';

/** Preference order per variant: first file that loads wins. */
const SOURCES: Record<CrestVariant, string[]> = {
  // The whole plate: crest, dedication, nasi and address.
  full: ['/logo-full.png', '/logo.png', '/logo-mark.png'],
  // Crest only, for tight spots like the site header.
  mark: ['/logo-mark.png', '/logo-full.png', '/logo.png'],
  // Crest only in the lighter gold, which is what reads on the dark board.
  'mark-light': ['/logo-mark-light.png', '/logo-mark.png', '/logo-full.png', '/logo.png'],
};

const HEIGHTS = {
  xs: 'h-9',
  sm: 'h-12',
  md: 'h-20',
  lg: 'h-32 sm:h-44',
  xl: 'h-40 sm:h-56',
} as const;

const WORDMARK_HE = {
  xs: 'text-base', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl sm:text-5xl', xl: 'text-5xl sm:text-6xl',
} as const;

const WORDMARK_EN = {
  xs: 'text-[9px]', sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm', xl: 'text-base',
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

  // Nothing loaded — stand in with the shul's name set as a wordmark.
  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <span className={`he font-hebrew font-bold ${WORDMARK_HE[size]} ${dark ? 'text-gold-200' : 'text-walnut-800'}`}>
        {nameHe}
      </span>
      <span
        className={`mt-1.5 font-display uppercase tracking-[0.22em] ${WORDMARK_EN[size]} ${
          dark ? 'text-gold-400/80' : 'text-gold-700'
        }`}
      >
        {nameEn}
      </span>
    </span>
  );
}
