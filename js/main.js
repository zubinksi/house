/*
 * main.js — chooses the weather and wires up the controls.
 *
 * First visit follows the visitor's clock: sunlight by day, moonlight after
 * dark. A chosen mode is remembered on this device.
 *   S sunlight · M moonlight · R rain · A sound on/off
 */
(function () {
  const House = window.House;
  const MODES = {
    sun: { outside: 'clear sky' },
    moon: { outside: 'clear night' },
    rain: { outside: 'light rain' },
  };
  const KEYS = { s: 'sun', m: 'moon', r: 'rain' };
  const root = document.documentElement;

  function initialMode() {
    try {
      const saved = localStorage.getItem('house.mode');
      if (MODES[saved]) return saved;
    } catch (e) {}
    const h = new Date().getHours();
    return h >= 6 && h < 19 ? 'sun' : 'moon';
  }

  function setMode(m, remember) {
    if (!MODES[m] || root.dataset.mode === m && remember) return;
    root.dataset.mode = m;
    document.querySelectorAll('[data-mode-btn]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.modeBtn === m));
    });
    document.querySelector('[data-outside]').textContent = MODES[m].outside;
    House.light.set(m);
    House.sound.setMode(m);
    if (remember) {
      try { localStorage.setItem('house.mode', m); } catch (e) {}
    }
  }

  function toggleSound() {
    const on = House.sound.toggle();
    const b = document.querySelector('[data-sound]');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('span').textContent = on ? 'on' : 'off';
  }

  function tickClock() {
    const el = document.querySelector('[data-clock]');
    el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  House.light.mount(document.getElementById('light'));
  House.market.mount(document.querySelector('[data-room="markets"]'));

  document.querySelectorAll('[data-mode-btn]').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.modeBtn, true));
  });
  document.querySelector('[data-sound]').addEventListener('click', toggleSound);

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (KEYS[k]) setMode(KEYS[k], true);
    if (k === 'a') toggleSound();
  });

  setMode(initialMode(), false);
  tickClock();
  setInterval(tickClock, 15000);
})();
