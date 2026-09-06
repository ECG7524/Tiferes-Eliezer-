import type { ReactNode } from 'react';

/**
 * The board's materials and ornament, drawn rather than imaged so it stays
 * crisp on any monitor.
 *
 * The palette is the shul's own printed work: a carved walnut ground, deep
 * burgundy bands and title plaques, gold rules and scrollwork, and cream
 * parchment for anything that has to be read across a room.
 */

export const GOLD = '#C9A227';
export const GOLD_LIGHT = '#F0D98F';
export const GOLD_DEEP = '#8A6B18';
export const WINE = '#5E1A28';
export const WINE_DEEP = '#3A0E18';
export const WINE_LIGHT = '#7C2437';
const WOOD_DARK = '#241408';

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

function noise(baseFrequency: string, opacity: number, octaves = 4): string {
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${octaves}"/></filter>
      <rect width="240" height="240" filter="url(#n)" opacity="${opacity}"/>
    </svg>`,
  )}")`;
}

/** The carved walnut the whole board is mounted on. */
export function BoardGround() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(176deg, #6E4520 0%, #4E2F14 22%, #5C3A1B 46%, #40270F 72%, #2A1809 100%)',
        }}
      />
      {/* Long grain, then irregular figure over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: noise('0.7 0.012', 0.55, 5), opacity: 0.45 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: noise('0.02 0.09', 0.5, 3), opacity: 0.35 }}
      />
      {/* Light falling from above, and the edges dropping away. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -12%, rgba(255,226,170,.26), transparent 60%), radial-gradient(ellipse 120% 100% at 50% 50%, transparent 45%, rgba(0,0,0,.55) 100%)',
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edge bands                                                          */
/* ------------------------------------------------------------------ */

function vineTile(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="112" viewBox="0 0 56 112">
    <g fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round">
      <path d="M28 0 V112" stroke-width="1.1" opacity="0.5"/>
      <path d="M28 13 C43 13 50 26 41 34 C36 39 27 36 29 27"/>
      <path d="M28 69 C13 69 6 82 15 90 C20 95 29 92 27 83"/>
      <path d="M28 41 C38 46 40 55 33 62"/>
      <path d="M28 41 C18 46 16 55 23 62"/>
      <path d="M28 95 C38 99 40 107 34 112"/>
      <path d="M28 95 C18 99 16 107 22 112"/>
    </g>
    <circle cx="28" cy="52" r="3.4" fill="${GOLD_LIGHT}"/>
    <circle cx="28" cy="104" r="2.2" fill="${GOLD}"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The burgundy bands down both edges with gold scrollwork over them, as on the
 * shul's flyers. Both sides are written out in full: a class name built from a
 * variable is invisible to Tailwind's scanner and gets stripped.
 */
export function FiligreeEdges() {
  const band = {
    backgroundImage: vineTile(),
    backgroundRepeat: 'repeat-y' as const,
    backgroundPosition: 'center top',
  };
  const plinth = {
    background: `linear-gradient(90deg, ${WINE_DEEP}, ${WINE} 45%, ${WINE_LIGHT} 60%, ${WINE_DEEP})`,
    boxShadow: 'inset 0 0 30px rgba(0,0,0,.7)',
  };
  const rule = { background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` };

  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[56px]" style={plinth} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[56px]" style={band} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[56px] w-[3px]" style={rule} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[56px]" style={plinth} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[56px]" style={band} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-[56px] w-[3px]" style={rule} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Flourishes                                                          */
/* ------------------------------------------------------------------ */

/** A rule with a centred medallion, for under the shul's name. */
export function Flourish({ className = '', width = 340 }: { className?: string; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 340 18" width={width} className={className} fill="none">
      <path d="M6 9 H140" stroke={GOLD} strokeWidth="1.4" opacity="0.85" />
      <path d="M200 9 H334" stroke={GOLD} strokeWidth="1.4" opacity="0.85" />
      <path d="M140 9 C153 9 157 3 164 9 C157 15 153 9 140 9 Z" fill={GOLD} />
      <path d="M200 9 C187 9 183 3 176 9 C183 15 187 9 200 9 Z" fill={GOLD} />
      <path d="M170 1 L177 9 L170 17 L163 9 Z" fill={GOLD_LIGHT} />
      <circle cx="136" cy="9" r="2" fill={GOLD} />
      <circle cx="204" cy="9" r="2" fill={GOLD} />
    </svg>
  );
}

/** A small centred ornament, for closing a short block of text. */
export function Fleuron({ className = '', width = 110 }: { className?: string; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 110 16" width={width} className={className} fill="none">
      <path d="M4 8 H40" stroke={GOLD_DEEP} strokeWidth="1.1" opacity="0.7" />
      <path d="M70 8 H106" stroke={GOLD_DEEP} strokeWidth="1.1" opacity="0.7" />
      <path d="M46 8 C50 2 55 2 55 8 C55 14 50 14 46 8 Z" fill={GOLD_DEEP} opacity="0.85" />
      <path d="M64 8 C60 2 55 2 55 8 C55 14 60 14 64 8 Z" fill={GOLD_DEEP} opacity="0.85" />
      <circle cx="55" cy="8" r="2.4" fill={GOLD} />
    </svg>
  );
}

/** The scrolled corner at each corner of a panel. */
function Corner({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 34 34" className={`absolute z-10 h-[30px] w-[30px] ${className}`} fill="none">
      <path d="M3 22 C3 10 10 3 22 3" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 10 C14 6 21 7 21 12 C21 16 15 17 14 13" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="12" r="1.8" fill={GOLD_LIGHT} />
    </svg>
  );
}

/** A palmette keystone, for the apex of an arch. */
function Keystone({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 42" className={`absolute z-20 h-[38px] w-[56px] ${className}`}>
      <path
        d="M30 3 C34 15 46 19 53 28 C44 32 33 28 31 21 L31 40 L29 40 L29 21 C27 28 16 32 7 28 C14 19 26 15 30 3 Z"
        fill={GOLD}
        stroke={GOLD_DEEP}
        strokeWidth="0.8"
      />
      <circle cx="30" cy="4" r="3.8" fill={GOLD_LIGHT} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Parchment panel                                                     */
/* ------------------------------------------------------------------ */

/**
 * A parchment plate under a carved arch, its title on a burgundy plaque hung
 * below the apex.
 *
 * The arch is an elliptical border radius rather than an SVG path, so it holds
 * its shape at any panel width instead of stretching.
 */
export function Panel({
  title,
  arched = true,
  className = '',
  bodyClassName = '',
  children,
}: {
  title?: string;
  /** Off for the short full-width strips, where a dome only eats height. */
  arched?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const radius = arched ? '44% 44% 14px 14px / 24% 24% 14px 14px' : '14px';

  return (
    <section className={`relative flex min-h-0 flex-col ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background:
            'radial-gradient(130% 90% at 50% 0%, #FFFEF8 0%, #FBF3DE 34%, #F2E5C2 68%, #E4D0A4 100%)',
          boxShadow: [
            `0 0 0 2px ${GOLD}`,
            `0 0 0 8px ${WINE_DEEP}`,
            `0 0 0 9px ${GOLD}`,
            '0 18px 40px -12px rgba(0,0,0,.7)',
            'inset 0 2px 0 rgba(255,255,255,.8)',
            'inset 0 -30px 50px -30px rgba(120,86,32,.5)',
          ].join(', '),
        }}
      />
      {/* Parchment fibre. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ borderRadius: radius, backgroundImage: noise('0.8 0.8', 0.35, 3), opacity: 0.22 }}
      />
      {/* Inner rule following the arch. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[11px]"
        style={{
          borderRadius: arched ? '44% 44% 9px 9px / 24% 24% 9px 9px' : '9px',
          border: `1.5px solid rgba(154,122,28,.55)`,
        }}
      />

      {arched ? (
        <Keystone className="-top-[29px] left-1/2 -translate-x-1/2" />
      ) : (
        <>
          <Corner className="-left-[11px] -top-[11px]" />
          <Corner className="-right-[11px] -top-[11px] scale-x-[-1]" />
        </>
      )}
      <Corner className="-bottom-[11px] -left-[11px] scale-y-[-1]" />
      <Corner className="-bottom-[11px] -right-[11px] scale-[-1]" />

      {title && (
        <div className={`relative z-10 flex justify-center ${arched ? 'mt-[5%]' : '-mt-[18px]'}`}>
          <span
            className="rounded-md px-7 py-1 text-center text-xl font-semibold uppercase tracking-[0.16em] text-gold-200 2xl:text-2xl"
            style={{
              background: `linear-gradient(180deg, ${WINE_LIGHT}, ${WINE_DEEP})`,
              boxShadow: `0 0 0 1.5px ${GOLD}, 0 4px 14px rgba(0,0,0,.6)`,
              textShadow: '0 1px 2px rgba(0,0,0,.5)',
            }}
          >
            {title}
          </span>
        </div>
      )}

      <div className={`relative min-h-0 flex-1 overflow-hidden px-6 pb-5 pt-3 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
