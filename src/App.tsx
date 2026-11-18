/*
 * Home Office: a paper slab on a wall. The bronze switch turns the light on the
 * wall between sunlight and moonlight; the slab holds two pages, markets and
 * address, with the sidebar's list for whichever is open.
 *   S sunlight · M moonlight · T turn the switch · A sound · / search markets
 */
import { useCallback, useEffect, useState } from 'react';
import { Mast } from './Mast';
import { Sidebar } from './Sidebar';
import { Markets } from './Markets';
import { Address } from './Address';
import { useMarkets } from './hl';
// plain-JS engines carried over from the first version
import { light } from './weather/light.js';
import { sound } from './weather/sound.js';

export type Mode = 'sun' | 'moon';
export type Page = 'markets' | 'address';
/** The chart's colours in each light: ink for the line, thread for the linen. */
export interface Palette { dark: boolean; ink: string; thread: string }
const PALETTES: Record<Mode, Palette> = {
  sun: { dark: false, ink: '#3a2e24', thread: '#7a6650' },
  moon: { dark: true, ink: '#e8ebf1', thread: '#a3aec3' },
};

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // remembered for the visit only
  }
};

function firstMode(): Mode {
  const saved = get('house.mode');
  if (saved === 'sun' || saved === 'moon') return saved;
  const h = new Date().getHours();
  return h >= 6 && h < 19 ? 'sun' : 'moon';
}
const pageFromHash = (): Page => (location.hash === '#address' ? 'address' : 'markets');

export function App() {
  const [mode, setModeState] = useState<Mode>(firstMode);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [coin, setCoinState] = useState(() => get('house.coin') || 'HYPE');
  const [address, setAddressState] = useState(() => get('house.address') || '');
  const [soundOn, setSoundOn] = useState(false);
  // prototype: the slab as frosted vellum, the light showing through
  const [vellum, setVellum] = useState(() => get('house.vellum') !== 'off');
  useEffect(() => {
    if (vellum) document.documentElement.dataset.vellum = '';
    else delete document.documentElement.dataset.vellum;
    put('house.vellum', vellum ? 'on' : 'off');
  }, [vellum]);
  const [searchSignal, setSearchSignal] = useState(0);
  // phones: the sidebar is a menu laid over the page, opened from its icon
  const [menu, setMenu] = useState(false);
  const [returned, setReturned] = useState(false);
  const openMenu = () => {
    setMenu(true);
    setReturned(false);
    window.scrollTo({ top: 0 });
  };
  const closeMenu = useCallback(() => {
    setMenu((open) => {
      if (open) {
        setReturned(true);
        window.scrollTo({ top: 0 });
      }
      return false;
    });
  }, []);
  const { list: markets, error } = useMarkets();

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    put('house.mode', m);
  }, []);
  const turn = useCallback(() => setMode(mode === 'moon' ? 'sun' : 'moon'), [mode, setMode]);
  const toggleSound = useCallback(() => setSoundOn(sound.toggle()), []);
  const setCoin = (c: string) => {
    setCoinState(c);
    put('house.coin', c);
  };
  const setAddress = (a: string) => {
    setAddressState(a);
    put('house.address', a);
  };

  // the light on the wall, the sound outside, and the page's colours
  useEffect(() => {
    light.mount(document.getElementById('light'));
    light.mountPaper(document.getElementById('paper-light'));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    light.set(mode);
    sound.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as Element).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 's') setMode('sun');
      else if (k === 'm') setMode('moon');
      else if (k === 't') turn();
      else if (k === 'a') toggleSound();
      else if (k === 'v') setVellum((v) => !v);
      else if (k === '/') {
        e.preventDefault();
        if (page !== 'markets') location.hash = 'markets';
        setSearchSignal((n) => n + 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, setMode, turn, toggleSound, closeMenu]);

  const palette = PALETTES[mode];
  return (
    <>
      <Mast
        mode={mode}
        onTurn={turn}
        soundOn={soundOn}
        onSound={toggleSound}
        vellum={vellum}
        onVellum={() => setVellum((v) => !v)}
      />
      {/* the slab, with two loose sheets beneath it (shown as vellum) */}
      <div className="slab-stack">
      <span className="sheet sheet-1" aria-hidden />
      <span className="sheet sheet-2" aria-hidden />
      <main className={`slab${menu ? ' is-menu' : ''}${returned ? ' has-returned' : ''}`}>
        <Sidebar
          page={page}
          markets={markets}
          coin={coin}
          onCoin={(c) => {
            setCoin(c);
            closeMenu();
          }}
          address={address}
          onAddress={(a) => {
            setAddress(a);
            closeMenu();
          }}
          onClose={closeMenu}
        />
        {page === 'markets' ? (
          <Markets key="markets" coin={coin} onCoin={setCoin} markets={markets} error={error} palette={palette} searchSignal={searchSignal} onMenu={openMenu} />
        ) : (
          <Address key="address" address={address} onAddress={setAddress} palette={palette} onMenu={openMenu} />
        )}
      </main>
      </div>
    </>
  );
}
