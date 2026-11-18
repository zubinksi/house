/*
 * The masthead, straight on the wall: the iris and today's date on the left
 * (after the home repo's), the time, sound and the bronze switch on the right.
 */
import { useEffect, useState } from 'react';
import iris from './assets/iris-white.png';
import type { Mode } from './App';

/** "NOV 17" */
const dateline = (d: Date) => `${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${d.getDate()}`;

export function Mast({ mode, onTurn, soundOn, onSound, vellum, onVellum }: {
  mode: Mode;
  onTurn: () => void;
  soundOn: boolean;
  onSound: () => void;
  vellum: boolean;
  onVellum: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  const moon = mode === 'moon';

  return (
    <header className="mast">
      <a className="mast-home" href="#markets" aria-label={`Home Office, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: markets`}>
        {/* the iris from the home repo, cut out and filled with the wall's ink */}
        <span className="mast-iris" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />
        {/* today's date, in the masthead's serif capitals: NOV 17 */}
        <span className="mast-title">{dateline(now)}</span>
      </a>

      <div className="mast-right">
        <span className="mast-note">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        {/* prototype: the slab as frosted vellum */}
        <button type="button" className="mast-text" aria-pressed={vellum} onClick={onVellum} title="Vellum (V)">
          {vellum ? 'vellum on' : 'vellum off'}
        </button>
        <button type="button" className="mast-text" aria-pressed={soundOn} onClick={onSound} title="Sound (A)">
          {soundOn ? 'sound on' : 'sound off'}
        </button>

        {/* the home repo's bronze lock, turned to the light: a sun and a moon are
            engraved either end, and the knob rolls over one, leaving the light
            you're in showing */}
        <button
          type="button"
          className="mast-switch"
          role="switch"
          aria-checked={moon}
          aria-label={moon ? 'Moonlight. Turn to sunlight' : 'Sunlight. Turn to moonlight'}
          title="Sunlight / moonlight (T)"
          onClick={onTurn}
        >
          <span className="switch-track" aria-hidden>
            <svg className="switch-icon switch-sun" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="2.6" />
              <path d="M7 1v1.6M7 11.4V13M1 7h1.6M11.4 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M2.8 11.2l1.1-1.1M10.1 3.9l1.1-1.1" />
            </svg>
            <svg className="switch-icon switch-moon" viewBox="0 0 14 14">
              <path className="fill" d="M10.8 9.4A5 5 0 0 1 4.6 3.2a5 5 0 1 0 6.2 6.2z" />
            </svg>
            <span className="switch-knob" />
          </span>
        </button>
      </div>
    </header>
  );
}
