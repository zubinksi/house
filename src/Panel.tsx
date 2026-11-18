/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only): the sun/moon switch on the left, the iris (the maker's mark)
 * at the centre, and push keys for the chart's range on the right, the chosen
 * one staying pressed in. On a phone the same panel stands upright, like an
 * intercom by the door: the iris moves to the bezel above the screen
 * (PanelTop) and the strip sits at the bottom, in reach of a thumb.
 */
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';

export function Panel({ keys, active, onKey, moon, onTurn, dim = false }: {
  keys: readonly string[];
  active: string;
  onKey: (k: string) => void;
  moon: boolean;
  onTurn: () => void;
  /** phones, with the menu open: no chart, so the keys sit unlit (a press still works) */
  dim?: boolean;
}) {
  return (
    <div className="panel-strip">
      <div className="panel-side">
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>

      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />

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

/** Phones: the bezel above the screen, with the iris at its centre. */
export function PanelTop() {
  return (
    <div className="panel-top" aria-hidden>
      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} />
    </div>
  );
}
