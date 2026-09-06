'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The shul's crest. Drop the artwork in at public/logo.png and it takes over;
 * until then this renders a typographic stand-in so nothing looks broken.
 */
export function Crest({
  className = '',
  size = 'md',
  nameHe = 'קהל תפארת אליעזר',
  nameEn = 'Kehal Tiferes Eliezer',
  dark = false,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  nameHe?: string;
  nameEn?: string;
  dark?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the file is missing, the load fails during server-rendered HTML — before
  // React attaches onError — so the fallback would never appear. Check the
  // already-settled image once on mount to catch that case.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  const heights = { sm: 'h-11', md: 'h-16', lg: 'h-28 sm:h-40' };
  const heType = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl sm:text-5xl' };
  const enType = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' };

  if (!broken) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        ref={imgRef}
        src="/logo.png"
        alt={`${nameEn} — ${nameHe}`}
        onError={() => setBroken(true)}
        className={`${heights[size]} w-auto object-contain ${className}`}
      />
    );
  }

  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <span
        className={`he font-hebrew font-bold ${heType[size]} ${dark ? 'text-gold-200' : 'text-walnut-800'}`}
      >
        {nameHe}
      </span>
      <span
        className={`mt-1.5 font-display uppercase tracking-[0.22em] ${enType[size]} ${
          dark ? 'text-gold-400/80' : 'text-gold-700'
        }`}
      >
        {nameEn}
      </span>
    </span>
  );
}
