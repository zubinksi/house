/*
 * The amber bulb: an ST64 Edison bulb hanging on its cord in the wall's margin
 * at night. Tungsten filament, amber glass, a dark brass socket; it sways a
 * little and throws a warm pool on the wall and the slab's near corner.
 * Shown only in moonlight (CSS fades it in), and only where the margin has room.
 */
export function Bulb() {
  return (
    <div className="bulb" aria-hidden>
      <div className="bulb-glow" />
      <div className="bulb-hang">
        <span className="bulb-cord" />
        <svg className="bulb-svg" viewBox="0 0 60 96">
          <defs>
            <radialGradient id="bulb-glass" cx="50%" cy="62%" r="60%">
              <stop offset="0" stopColor="#ffd48c" stopOpacity="0.8" />
              <stop offset="0.5" stopColor="#f0a04a" stopOpacity="0.5" />
              <stop offset="1" stopColor="#a8571f" stopOpacity="0.35" />
            </radialGradient>
            <linearGradient id="bulb-brass" x1="0" x2="1">
              <stop offset="0" stopColor="#3a2c1c" />
              <stop offset="0.45" stopColor="#7a5c34" />
              <stop offset="1" stopColor="#2a2016" />
            </linearGradient>
            <filter id="bulb-burn" x="-50%" y="-20%" width="200%" height="140%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* socket */}
          <rect x="22" y="0" width="16" height="15" rx="1.5" fill="url(#bulb-brass)" />
          <path d="M22 4.5h16M22 8.5h16" stroke="#1e160e" strokeWidth="0.6" opacity="0.6" />
          {/* the glass: the ST64's teardrop */}
          <path
            className="bulb-glass"
            d="M24 15 C24 22 11 32 11 56 C11 76 20 90 30 92 C40 90 49 76 49 56 C49 32 36 22 36 15 Z"
            fill="url(#bulb-glass)"
            stroke="#ffd9a6"
            strokeOpacity="0.32"
            strokeWidth="0.7"
          />
          {/* the stem and the cage of tungsten wires */}
          <path d="M30 15 V30" stroke="#ffe0b0" strokeOpacity="0.55" strokeWidth="0.8" />
          <g className="bulb-filament" filter="url(#bulb-burn)" fill="none" stroke="#fff6dc" strokeWidth="0.95" strokeLinecap="round">
            <path d="M30 30 L22 34 L20 72 M30 30 L25 33 L24.5 76 M30 30 L30 78 M30 30 L35 33 L35.5 76 M30 30 L38 34 L40 72" />
            <path d="M20 72 L24.5 76 L30 78 L35.5 76 L40 72" strokeOpacity="0.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}
