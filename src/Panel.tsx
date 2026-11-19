/*
 * The wall panel's hardware. The strip under the screen: a drum at the bottom
 * left, rolled to step through markets, and push keys for the chart's range on
 * the right, the chosen one staying pressed in. The bezel above the screen
 * (PanelTop): a sensor and status light at the left, the iris at the centre and
 * the sun/moon switch at the right. On a phone the same panel stands upright,
 * like an intercom by the door.
 */
import { useEffect, useRef, useState } from 'react';
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';
import { useLiveStatus } from './hl';

export function Panel({ keys, active, onKey, dim = false, drum }: {
  keys: readonly string[];
  active: string;
  onKey: (k: string) => void;
  /** phones, with the menu open: no chart, so the keys sit unlit (a press still works) */
  dim?: boolean;
  drum: DrumProps;
}) {
  return (
    <div className="panel-strip">
      <div className="panel-side">
        <Drum {...drum} />
      </div>

      <div className="panel-side">
        <div className="panel-keys" role="group" aria-label="Range" data-dim={dim || undefined}>
          {keys.map((k) => (
            <button key={k} type="button" className="hw-key" aria-pressed={k === active} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface DrumProps {
  /** ids in the sidebar's order */
  items: string[];
  current: string;
  label: (id: string) => string;
  onPick: (id: string) => void;
}

const SETTLE_MS = 320;

/**
 * A printed drum behind a window, rolled with a thumb: the entry in the window
 * is sharp, the ones above and below curve away. Each detent steps one entry;
 * when the drum comes to rest, the screen follows. Scroll, drag up or down, the
 * arrow keys, or tap the entry above or below.
 */
function Drum({ items, current, label, onPick }: DrumProps) {
  const [shown, setShown] = useState<string | null>(null); // while rolling
  const [roll, setRoll] = useState<'' | 'up' | 'down'>('');
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const acc = useRef(0);
  const drag = useRef<number | null>(null);
  const at = shown ?? current;
  const i = items.indexOf(at);

  useEffect(() => setShown(null), [current]);
  useEffect(() => () => clearTimeout(settle.current), []);

  const step = (dir: 1 | -1) => {
    if (!items.length) return;
    const from = i < 0 ? 0 : i;
    const to = Math.max(0, Math.min(items.length - 1, from + dir));
    if (to === from && i >= 0) return;
    const id = items[to];
    setShown(id);
    setRoll(dir > 0 ? 'up' : 'down');
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      setRoll('');
      if (id !== current) onPick(id);
      else setShown(null);
    }, SETTLE_MS);
  };

  const prev = i > 0 ? items[i - 1] : null;
  const next = i >= 0 && i < items.length - 1 ? items[i + 1] : null;

  return (
    <div
      className="hw-drum"
      role="slider"
      tabIndex={0}
      aria-label="Roll to change market"
      aria-valuetext={at ? label(at) : 'none'}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, items.length - 1)}
      aria-valuenow={Math.max(0, i)}
      onWheel={(e) => {
        acc.current += e.deltaY;
        if (Math.abs(acc.current) >= 30) {
          step(acc.current > 0 ? 1 : -1);
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
        if (Math.abs(dy) >= 16) {
          // roll it like a wheel: pushing up brings the next entry into the window
          step(dy < 0 ? 1 : -1);
          drag.current = e.clientY;
        }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { step(1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { step(-1); e.preventDefault(); }
      }}
    >
      <span className={`hw-drum-face${roll ? ' is-rolling-' + roll : ''}`} key={at + roll} aria-hidden>
        <span className="drum-row drum-prev">{prev ? label(prev) : ''}</span>
        <span className="drum-row drum-now">{at ? label(at) : '—'}</span>
        <span className="drum-row drum-next">{next ? label(next) : ''}</span>
      </span>
    </div>
  );
}

/** Phones: the bezel above the screen, with the iris at its centre. */
/**
 * The bezel above the screen: the iris at the centre and, at the top left, a
 * status light beside a small sensor window, as an intercom has. The light
 * breathes while prices stream, fainter while reconnecting, dark when offline.
 */
export function PanelTop({ moon, onTurn }: { moon: boolean; onTurn: () => void }) {
  const status = useLiveStatus();
  const words = { live: 'Live: prices streaming', connecting: 'Connecting', down: 'Offline' } as const;
  return (
    <div className="panel-top">
      <span className="panel-status" role="status" aria-label={words[status]} title={words[status]}>
        <span className="panel-sensor" aria-hidden />
        <span className="panel-lamp" data-state={status} aria-hidden />
      </span>
      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />
      <span className="panel-top-right">
        <LightSwitch moon={moon} onTurn={onTurn} />
      </span>
    </div>
  );
}
