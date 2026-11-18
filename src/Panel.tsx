/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only). On the left, a woven speaker grille; at the centre, the iris,
 * the maker's mark; on the right, push keys for the chart's range that stay
 * pressed in when chosen, and the sun/moon switch.
 */
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';

export function Panel({ keys, active, onKey, moon, onTurn }: {
  keys: readonly string[];
  active: string;
  onKey: (k: string) => void;
  moon: boolean;
  onTurn: () => void;
}) {
  return (
    <div className="panel-strip">
      <div className="panel-side">
        <span className="panel-grille" aria-hidden />
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
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>
    </div>
  );
}
