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

  // No artwork yet — set the name in a gold cartouche so the space reads as
  // designed rather than as a missing image.
  return (
    <span className={`inline-flex ${HEIGHTS[size]} items-center ${className}`}>
      <span className="relative flex h-full flex-col items-center justify-center px-[1.6em] py-[0.5em]">
        <Cartouche dark={dark} />
        <span
          className={`he relative font-hebrew font-bold leading-none ${WORDMARK_HE[size]} ${
            dark ? 'text-gold-200' : 'text-walnut-800'
          }`}
        >
          {nameHe}
        </span>
        <span
          className={`relative mt-[0.45em] font-display uppercase leading-none tracking-[0.22em] ${WORDMARK_EN[size]} ${
            dark ? 'text-gold-400/80' : 'text-gold-700'
          }`}
        >
          {nameEn}
        </span>
      </span>
    </span>
  );
}

/** The double gold rule and corner flourishes behind the wordmark. */
function Cartouche({ dark }: { dark: boolean }) {
  const gold = dark ? '#C9A227' : '#AC881D';
  const faint = dark ? '#8A6B18' : '#E3C766';

  return (
    <svg
      aria-hidden
      viewBox="0 0 200 68"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect x="1.5" y="1.5" width="197" height="65" rx="6" fill="none" stroke={gold} strokeWidth="1.2" />
      <rect x="5" y="5" width="190" height="58" rx="4" fill="none" stroke={faint} strokeWidth="0.6" />
      {/* A small diamond centred on each side, the way the crest's frame is set. */}
      {[
        [100, 3.2], [100, 64.8], [3.2, 34], [196.8, 34],
      ].map(([cx, cy]) => (
        <path
          key={`${cx}-${cy}`}
          d={`M ${cx} ${cy - 2.6} L ${cx + 2.6} ${cy} L ${cx} ${cy + 2.6} L ${cx - 2.6} ${cy} Z`}
          fill={gold}
        />
      ))}
    </svg>
  );
}
