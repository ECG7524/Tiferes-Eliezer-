import type { ReactNode } from 'react';

/**
 * The board's ornament, drawn rather than imaged so it stays crisp on any
 * monitor. It follows how a shul luach board is actually made: a carved wood
 * ground, cream parchment plates for the content, dark ink, and gold rules
 * and scrollwork between them.
 */

const GOLD = '#C9A227';
const GOLD_LIGHT = '#EBD48A';
const WOOD_DARK = '#2E1C0B';

/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* ------------------------------------------------------------------ */

/** The carved wood the whole board is mounted on. */
export function BoardGround() {
  // Irregular grain: fine repeating lines plus turbulence so it does not read
  // as a printed stripe.
  const grain = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves="4"/></filter>
      <rect width="220" height="220" filter="url(#g)" opacity="0.5"/>
    </svg>`,
  )}")`;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(178deg, #7A4E26 0%, #5E3A1B 26%, #6B4322 52%, #52331A 78%, #3E2612 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: grain, opacity: 0.38 }}
      />
      {/* A little light from above, the way a mounted board catches it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% -18%, rgba(255,225,170,.22), transparent 62%)',
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edge filigree                                                       */
/* ------------------------------------------------------------------ */

function vineTile(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="104" viewBox="0 0 52 104">
    <g fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round">
      <path d="M26 0 V104" stroke-width="1" opacity="0.45"/>
      <path d="M26 12 C40 12 46 24 38 32 C33 37 25 34 27 25"/>
      <path d="M26 64 C12 64 6 76 14 84 C19 89 27 86 25 77"/>
      <path d="M26 38 C35 43 37 51 31 58"/>
      <path d="M26 38 C17 43 15 51 21 58"/>
      <path d="M26 88 C35 92 37 99 32 104"/>
      <path d="M26 88 C17 92 15 99 20 104"/>
    </g>
    <circle cx="26" cy="48" r="3" fill="${GOLD_LIGHT}"/>
    <circle cx="26" cy="96" r="2" fill="${GOLD}"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The scrolled gold bands down both edges, as on the shul's printed work.
 * Both sides are written out in full: a class name built from a variable is
 * invisible to Tailwind's scanner and gets stripped from the stylesheet.
 */
export function FiligreeEdges() {
  const tile = vineTile();
  const band = {
    backgroundImage: tile,
    backgroundRepeat: 'repeat-y' as const,
    backgroundPosition: 'center top',
  };
  const plinth = {
    background: `linear-gradient(90deg, ${WOOD_DARK}, #4A2E14 55%, ${WOOD_DARK})`,
    boxShadow: 'inset 0 0 26px rgba(0,0,0,.6)',
  };

  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[52px]" style={plinth} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[52px]" style={band} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[52px]" style={plinth} />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[52px]" style={band} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[52px] w-[2px]"
        style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[52px] w-[2px]"
        style={{ background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)` }}
      />
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
      <path d="M6 9 H140" stroke={GOLD} strokeWidth="1.2" opacity="0.8" />
      <path d="M200 9 H334" stroke={GOLD} strokeWidth="1.2" opacity="0.8" />
      <path d="M140 9 C153 9 157 3 164 9 C157 15 153 9 140 9 Z" fill={GOLD} />
      <path d="M200 9 C187 9 183 3 176 9 C183 15 187 9 200 9 Z" fill={GOLD} />
      <path d="M170 2 L176 9 L170 16 L164 9 Z" fill={GOLD_LIGHT} />
      <circle cx="136" cy="9" r="1.8" fill={GOLD} />
      <circle cx="204" cy="9" r="1.8" fill={GOLD} />
    </svg>
  );
}

/** The scrolled corner at each corner of a panel. */
function Corner({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 34 34" className={`absolute z-10 h-[28px] w-[28px] ${className}`} fill="none">
      <path d="M3 22 C3 10 10 3 22 3" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
      <path d="M10 10 C14 6 21 7 21 12 C21 16 15 17 14 13" stroke={GOLD_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17.5" cy="12" r="1.6" fill={GOLD_LIGHT} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Parchment panel                                                     */
/* ------------------------------------------------------------------ */

/** A palmette keystone, for the apex of an arch. */
function Keystone({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 40" className={`absolute z-20 h-[34px] w-[52px] ${className}`}>
      <path
        d="M30 3 C34 14 45 18 52 27 C43 31 33 27 31 20 L31 38 L29 38 L29 20 C27 27 17 31 8 27 C15 18 26 14 30 3 Z"
        fill={GOLD}
      />
      <circle cx="30" cy="4" r="3.4" fill={GOLD_LIGHT} />
    </svg>
  );
}

/**
 * A parchment plate under a carved arch, its title on a dark plaque hung below
 * the apex — the arrangement the printed shul boards use.
 *
 * The arch is an elliptical border radius rather than an SVG path, so it keeps
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
  /** Off for the short full-width strips, where a dome wastes the height. */
  arched?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const radius = arched
    ? '46% 46% 12px 12px / 26% 26% 12px 12px'
    : '14px';

  return (
    <section className={`relative flex min-h-0 flex-col ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background:
            'radial-gradient(120% 80% at 50% 0%, #FFFDF4 0%, #FAF1DC 38%, #F0E2BE 72%, #E6D3A9 100%)',
          // Dark carved edge, a gold rule, then the parchment.
          boxShadow: [
            `0 0 0 2px ${GOLD}`,
            `0 0 0 7px ${WOOD_DARK}`,
            `0 0 0 8px ${GOLD}`,
            '0 14px 34px -10px rgba(0,0,0,.6)',
            'inset 0 2px 0 rgba(255,255,255,.75)',
          ].join(', '),
        }}
      />
      {/* An inner rule that follows the arch. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[10px]"
        style={{
          borderRadius: arched ? '46% 46% 8px 8px / 26% 26% 8px 8px' : '8px',
          border: `1px solid rgba(154,122,28,.45)`,
        }}
      />

      {arched ? (
        <Keystone className="-top-[26px] left-1/2 -translate-x-1/2" />
      ) : (
        <>
          <Corner className="-left-[10px] -top-[10px]" />
          <Corner className="-right-[10px] -top-[10px] scale-x-[-1]" />
        </>
      )}
      <Corner className="-bottom-[10px] -left-[10px] scale-y-[-1]" />
      <Corner className="-bottom-[10px] -right-[10px] scale-[-1]" />

      {title && (
        <div
          className={`relative z-10 flex justify-center ${arched ? 'mt-[6%]' : '-mt-[16px]'}`}
        >
          <span
            className="rounded-md px-6 py-[3px] text-center text-lg font-semibold uppercase tracking-[0.16em] text-gold-200 2xl:text-xl"
            style={{
              background: 'linear-gradient(180deg, #4A3014, #2A1A08)',
              boxShadow: `0 0 0 1.5px ${GOLD}, 0 3px 12px rgba(0,0,0,.55)`,
            }}
          >
            {title}
          </span>
        </div>
      )}

      <div
        className={`relative min-h-0 flex-1 overflow-hidden px-6 pb-5 ${arched ? 'pt-3' : 'pt-3'} ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
