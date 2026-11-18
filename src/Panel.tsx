/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only): the sun/moon switch on the left, the iris (the maker's mark)
 * at the centre, and push keys for the chart's range on the right, the chosen
 * one staying pressed in.
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
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>

      <span className="panel-mark" style={{ maskImage: `url(${iris})`, WebkitMaskImage: `url(${iris})` }} aria-hidden />

      <div className="panel-side">
        <div className="panel-keys" role="group" aria-label="Range">
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
