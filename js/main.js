/*
 * main.js — the weather, the pages, and the keys.
 *
 * The bronze switch on the wall turns between sunlight and moonlight; rain is a
 * day of its own beside it. First visit follows the visitor's clock. Choices
 * are remembered on this device.
 *   S sunlight · M moonlight · R rain · T turn the switch · A sound
 *   / search markets
 */
(function () {
  const House = window.House;
  const root = document.documentElement;
  const OUTSIDE = { sun: 'clear sky', moon: 'clear night', rain: 'light rain' };
  const PAGES = ['markets', 'address'];

  /* ── Weather ── */
  function initialMode() {
    try {
      const saved = localStorage.getItem('house.mode');
      if (OUTSIDE[saved]) return saved;
    } catch (e) {}
    const h = new Date().getHours();
    return h >= 6 && h < 19 ? 'sun' : 'moon';
  }

  function setMode(m, remember) {
    if (!OUTSIDE[m] || (remember && root.dataset.mode === m)) return;
    root.dataset.mode = m;
    const sw = document.querySelector('[data-switch]');
    sw.setAttribute('aria-checked', String(m === 'moon'));
    sw.setAttribute('aria-label', m === 'moon' ? 'Moonlight. Turn to sunlight' : 'Sunlight. Turn to moonlight');
    document.querySelector('[data-rain]').setAttribute('aria-pressed', String(m === 'rain'));
    document.querySelector('[data-outside]').textContent = OUTSIDE[m];
    House.light.set(m);
    House.sound.setMode(m);
    // the paper's colours changed: the charts redraw in the new ink
    setTimeout(() => { House.markets.redraw(); }, 720);
    if (remember) {
      try { localStorage.setItem('house.mode', m); } catch (e) {}
    }
  }
  const turn = () => setMode(root.dataset.mode === 'moon' ? 'sun' : 'moon', true);
  const rain = () => setMode(root.dataset.mode === 'rain' ? 'sun' : 'rain', true);

  function toggleSound() {
    const on = House.sound.toggle();
    const b = document.querySelector('[data-sound]');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'sound on' : 'sound off';
  }

  /* ── Pages ── */
  function showPage() {
    const name = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'markets';
    House.page = name;
    document.querySelectorAll('[data-page]').forEach((p) => (p.hidden = p.dataset.page !== name));
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (name === 'address') House.address.show();
    else House.markets.redraw();
  }

  function tickClock() {
    document.querySelector('[data-clock]').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  House.light.mount(document.getElementById('light'));
  House.markets.mount(document.querySelector('[data-page="markets"]'));
  House.address.mount(document.querySelector('[data-page="address"]'));

  document.querySelector('[data-switch]').addEventListener('click', turn);
  document.querySelector('[data-rain]').addEventListener('click', rain);
  document.querySelector('[data-sound]').addEventListener('click', toggleSound);
  window.addEventListener('hashchange', showPage);

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 's') setMode('sun', true);
    else if (k === 'm') setMode('moon', true);
    else if (k === 'r') setMode('rain', true);
    else if (k === 't') turn();
    else if (k === 'a') toggleSound();
    else if (k === '/') {
      e.preventDefault();
      if (House.page !== 'markets') location.hash = 'markets';
      House.markets.openSearch();
    }
  });

  setMode(initialMode(), false);
  showPage();
  tickClock();
  setInterval(tickClock, 15000);
})();
