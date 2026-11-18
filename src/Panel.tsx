/*
 * The panel's control strip: the hardware under the screen of the wall panel
 * (desktop only): a small woven speaker grille on the left, the iris (the
 * maker's mark) at the centre, and the sun/moon switch on the right.
 */
import iris from './assets/iris-white.png';
import { LightSwitch } from './Mast';

export function Panel({ moon, onTurn }: {
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
        <LightSwitch moon={moon} onTurn={onTurn} />
      </div>
    </div>
  );
}
