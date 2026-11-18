/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only). On the left, the speaker: a woven grille and its brass volume
 * knob. The iris sits at the centre, the maker's mark. On the right, push keys
 * for the chart's range that stay pressed in when chosen, a star key that keeps
 * the open market or address, and the sun/moon switch.
 */
import { useRef } from 'react';
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';

export function Panel({ keys, active, onKey, starred, onStar, starLabel, moon, onTurn, soundOn, volume, onVolume, onSound }: {
  keys: readonly string[];
  active: string;
  onKey: (k: string) => void;
  starred: boolean;
  onStar: () => void;
  starLabel: string;
  moon: boolean;
  onTurn: () => void;
  soundOn: boolean;
  /** 0 to 1 */
  volume: number;
  onVolume: (v: number) => void;
  onSound: () => void;
}) {
  return (
    <div className="panel-strip">
      <div className="panel-side">
        <span className="panel-grille" aria-hidden />
        <VolumeKnob on={soundOn} volume={volume} onVolume={onVolume} onPress={onSound} />
      </div>

      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />

      <div className="panel-side panel-side-right">
        <div className="panel-keys" role="group" aria-label="Range">
          {keys.map((k) => (
            <button key={k} type="button" className="hw-key" aria-pressed={k === active} onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
        </div>
        <button type="button" className="hw-key hw-star" aria-pressed={starred} aria-label={starred ? `Unstar ${starLabel}` : `Star ${starLabel}`} onClick={onStar}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M8 1.6l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.1l-3.9 2.2.9-4.3L1.8 6.1l4.3-.5z" /></svg>
        </button>
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>
    </div>
  );
}

const STEP = 0.1;

/**
 * The speaker's brass volume knob. Turn it (scroll, drag up or down, or the
 * arrow keys) to set the room's sound; turning it from silence turns the sound
 * on, all the way down turns it off. Press it to switch the sound on or off.
 * Its notch sweeps from seven o'clock (silent) to five o'clock (full).
 */
function VolumeKnob({ on, volume, onVolume, onPress }: { on: boolean; volume: number; onVolume: (v: number) => void; onPress: () => void }) {
  const acc = useRef(0);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const shown = on ? volume : 0;

  const nudge = (dir: 1 | -1) => {
    const base = on ? volume : 0;
    const next = Math.round(Math.max(0, Math.min(1, base + dir * STEP)) * 10) / 10;
    onVolume(next);
  };

  return (
    <button
      type="button"
      className="hw-dial"
      role="slider"
      aria-label="Sound volume (press to switch the sound on or off)"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={on ? `${Math.round(volume * 100)}%` : 'off'}
      data-on={on || undefined}
      title={on ? `Sound ${Math.round(volume * 100)}%: turn to change, press for off` : 'Sound off: press or turn up'}
      style={{ ['--turn' as string]: `${-135 + shown * 270}deg` }}
      onWheel={(e) => {
        acc.current += e.deltaY;
        if (Math.abs(acc.current) >= 40) {
          nudge(acc.current < 0 ? 1 : -1);
          acc.current = 0;
        }
      }}
      onPointerDown={(e) => {
        drag.current = { y: e.clientY, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = e.clientY - d.y;
        if (Math.abs(dy) >= 14) {
          nudge(dy < 0 ? 1 : -1);
          d.y = e.clientY;
          d.moved = true;
        }
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) onPress();
      }}
      onPointerCancel={() => (drag.current = null)}
      onClick={(e) => {
        // keyboard Enter/Space presses it; pointer presses are handled above
        if (e.detail === 0) onPress();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { nudge(1); e.preventDefault(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { nudge(-1); e.preventDefault(); }
      }}
    >
      <span className="hw-dial-cap" aria-hidden />
    </button>
  );
}
