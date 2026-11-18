/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only). Range keys stay pressed in when chosen, a star key keeps the
 * open market or address, a brass dial steps through the sidebar's list, and the
 * sun/moon switch turns the light. A woven grille, a lit clock window and the
 * iris mark the maker.
 */
import { useEffect, useRef, useState } from 'react';
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';

/** Ask the sidebar's list for the next (1) or previous (-1) entry. */
export const step = (dir: 1 | -1) => window.dispatchEvent(new CustomEvent('house:step', { detail: dir }));

export function Panel({ keys, active, onKey, starred, onStar, starLabel, dialLabel, moon, onTurn }: {
  keys: readonly string[];
  active: string;
  onKey: (k: string) => void;
  starred: boolean;
  onStar: () => void;
  starLabel: string;
  dialLabel: string;
  moon: boolean;
  onTurn: () => void;
}) {
  return (
    <div className="panel-strip">
      <span className="panel-grille" aria-hidden />
      <Clock />
      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />

      <div className="panel-group">
        <div className="panel-keys" role="group" aria-label="Range">
          {keys.map((k) => (
            <button key={k} type="button" className="hw-key" aria-pressed={k === active} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-group">
        <button type="button" className="hw-key hw-star" aria-pressed={starred} aria-label={starred ? `Unstar ${starLabel}` : `Star ${starLabel}`} onClick={onStar}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M8 1.6l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.1l-3.9 2.2.9-4.3L1.8 6.1l4.3-.5z" /></svg>
        </button>
      </div>

      <div className="panel-group">
        <Dial label={dialLabel} />
      </div>

      <div className="panel-group">
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>
    </div>
  );
}

/**
 * A brass dial with a notch. Scroll over it, drag it up or down, or use the
 * arrow keys: each click of the dial steps one entry through the list.
 */
function Dial({ label }: { label: string }) {
  const el = useRef<HTMLButtonElement>(null);
  const turns = useRef(0);
  const acc = useRef(0);
  const drag = useRef<number | null>(null);

  const click = (dir: 1 | -1) => {
    turns.current += dir;
    if (el.current) el.current.style.setProperty('--turn', `${turns.current * 24}deg`);
    step(dir);
  };

  return (
    <button
      ref={el}
      type="button"
      className="hw-dial"
      role="slider"
      aria-label="Dial: step through the list"
      aria-valuetext={label}
      title="Turn to step through the list (scroll, drag or arrow keys)"
      onWheel={(e) => {
        acc.current += e.deltaY;
        if (Math.abs(acc.current) >= 40) {
          click(acc.current > 0 ? 1 : -1);
          acc.current = 0;
        }
      }}
      onPointerDown={(e) => {
        drag.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current == null) return;
        const dy = e.clientY - drag.current;
        if (Math.abs(dy) >= 22) {
          click(dy > 0 ? 1 : -1);
          drag.current = e.clientY;
        }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { click(1); e.preventDefault(); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { click(-1); e.preventDefault(); }
      }}
    >
      <span className="hw-dial-cap" aria-hidden />
    </button>
  );
}

/** The panel's clock window: today's date and the time, lit behind dark glass. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  const date = `${now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${now.getDate()}`;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <span className="panel-clock" role="timer" aria-label={`${date}, ${time}`}>
      <span>{date}</span>
      <span>{time}</span>
    </span>
  );
}
