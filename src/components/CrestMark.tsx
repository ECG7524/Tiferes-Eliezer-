/**
 * The shul's crest, drawn.
 *
 * A stand-in for the real artwork: an oval cartouche carrying the shul's name,
 * crowned with a palmette and flanked by acanthus scrollwork, in the same gold
 * and cream as the printed crest. The moment `logo-mark.png` and friends are
 * added to `public/`, those take over and this is never seen again.
 */
export function CrestMark({
  nameHe = 'קהל תפארת אליעזר',
  className = '',
  dark = false,
}: {
  nameHe?: string;
  className?: string;
  /** Sits on wood rather than on the ivory site. */
  dark?: boolean;
}) {
  const words = nameHe.split(/\s+/).filter(Boolean);
  const field = dark ? '#F6ECD2' : '#FBF4E2';

  return (
    <svg
      viewBox="0 0 372 196"
      className={`h-full w-auto ${className}`}
      role="img"
      aria-label={nameHe}
    >
      <defs>
        <linearGradient id="cm-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0D98F" />
          <stop offset="38%" stopColor="#C9A227" />
          <stop offset="62%" stopColor="#9A7A1C" />
          <stop offset="100%" stopColor="#E3C766" />
        </linearGradient>
        <linearGradient id="cm-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="100%" stopColor={field} />
        </linearGradient>
        <g id="cm-wing">
          {/* Acanthus scroll sweeping out from the cartouche to a volute. */}
          <path
            d="M268 74 C300 60 336 68 352 92 C361 105 354 124 340 124 C328 124 321 113 327 104 C332 97 342 100 341 108"
            fill="none"
            stroke="url(#cm-gold)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M270 100 C298 96 324 104 338 120"
            fill="none"
            stroke="url(#cm-gold)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Leaves along the sweep. */}
          <path d="M292 62 C300 46 316 42 326 50 C316 62 302 66 292 62 Z" fill="url(#cm-gold)" />
          <path d="M322 74 C332 60 348 58 355 67 C344 77 331 79 322 74 Z" fill="url(#cm-gold)" opacity="0.92" />
          <path d="M276 116 C288 116 298 124 300 134 C288 134 279 127 276 116 Z" fill="url(#cm-gold)" opacity="0.8" />
          <circle cx="343" cy="108" r="5" fill="#F0D98F" />
        </g>
      </defs>

      {/* ---- Scroll wings ---- */}
      <use href="#cm-wing" />
      <use href="#cm-wing" transform="translate(372,0) scale(-1,1)" />

      {/* ---- Plinth ---- */}
      <path
        d="M96 174 C140 164 232 164 276 174"
        fill="none"
        stroke="url(#cm-gold)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M78 184 C132 172 240 172 294 184"
        fill="none"
        stroke="url(#cm-gold)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="80" cy="184" r="5.5" fill="url(#cm-gold)" />
      <circle cx="292" cy="184" r="5.5" fill="url(#cm-gold)" />

      {/* ---- Crown ---- */}
      <path
        d="M186 4 C191 18 204 23 212 33 C202 37 191 32 187 25 L187 44 L185 44 L185 25 C181 32 170 37 160 33 C168 23 181 18 186 4 Z"
        fill="url(#cm-gold)"
      />
      <circle cx="186" cy="5" r="5" fill="#F0D98F" />

      {/* ---- Cartouche ---- */}
      <ellipse cx="186" cy="102" rx="94" ry="76" fill="url(#cm-gold)" />
      <ellipse cx="186" cy="102" rx="86" ry="68" fill="url(#cm-field)" />
      <ellipse
        cx="186"
        cy="102"
        rx="80"
        ry="62"
        fill="none"
        stroke="#C9A227"
        strokeWidth="1.6"
        opacity="0.85"
      />

      {/* Small diamonds on the cartouche's axes. */}
      {[
        [186, 30], [186, 174], [94, 102], [278, 102],
      ].map(([cx, cy]) => (
        <path
          key={`${cx}-${cy}`}
          d={`M${cx} ${cy - 6} L${cx + 6} ${cy} L${cx} ${cy + 6} L${cx - 6} ${cy} Z`}
          fill="#F0D98F"
        />
      ))}

      {/* ---- The name ---- */}
      <text
        x="186"
        y="102"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#33220E"
        style={{ fontFamily: 'var(--font-hebrew), serif', fontWeight: 700 }}
        fontSize={words.length > 2 ? 38 : 44}
      >
        {words.length > 1 ? (
          words.map((w, i) => (
            <tspan key={w + i} x="186" dy={i === 0 ? -(words.length - 1) * 21 : 42}>
              {w}
            </tspan>
          ))
        ) : (
          <tspan x="186">{nameHe}</tspan>
        )}
      </text>
    </svg>
  );
}
