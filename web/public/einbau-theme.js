/* Einbau suite theme — ONE file every app loads, so colours and light/dark
 * behave identically everywhere. Served by HELM at
 *   https://lambwright.github.io/helm/einbau-theme.js
 * (plain script, no build step; works in React apps, plain HTML pages, the
 * LEDGER Procore sidebar and anything embedded in Procore later).
 *
 * Usage (after sign-in / on every verify):
 *   EinbauTheme.apply({ app: 'TALLY', defaultAccent: '#E2871A', user })
 *   EinbauTheme.reset()                       // on sign-out
 * user.themeAccent = { APP: presetId } (per person, per app, saved in Einbau ID)
 * user.themeMode   = 'system' | 'dark' | 'light' (one setting for all apps;
 *                    default 'system' = follow the device/browser)
 *
 * It sets these CSS custom properties on <html> (use ONLY these for colour):
 *   --bg-page --bg-card --bg-input --bg-header --bg-hover
 *   --border-color --border-input
 *   --text-primary --text-secondary --text-tertiary
 *   --accent --accent-dark --accent-rgb --accent-contrast --accent-soft --accent-2
 *   --red --red-light --red-border --green --green-light --yellow --yellow-light
 *   --shadow-sm --shadow-md
 * Surface roles (use these for the big pieces so a chosen colour can take
 * over the screen):
 *   --header-bg --header-text --header-text-muted --header-name --header-strip
 *   --btn-bg --btn-text --btn-2-bg --btn-2-text --btn-2-border
 *   --tab-bg --tab-text --tab-border --tab-active-bg --tab-active-text --tab-active-border
 *   --title-color --badge-bg --badge-text
 * and <html data-theme="dark|light" data-accent="default|bold" style="color-scheme: …">.
 * App default colour → "default": quiet surfaces, colour on details (unchanged
 * look). A colour the person picked → "bold": filled header banner, filled
 * buttons and tabs, coloured titles, with readable lettering on every fill.
 * Never hardcode a hex colour in an app: light mode will leave a dark patch.
 */
(function () {
  'use strict';

  // accent = main colour; accent2 = optional second colour (header strip etc.)
  var PRESETS = [
    { id: 'tungsten', label: 'Tungsten', accent: '#9BA8B5' },
    { id: 'amber', label: 'Amber', accent: '#D1A93F' },
    { id: 'crimson', label: 'Crimson', accent: '#D14343' },
    { id: 'forest', label: 'Forest', accent: '#6FB35C' },
    { id: 'violet', label: 'Violet', accent: '#9B7ED1' },
    { id: 'teal', label: 'Teal', accent: '#3F9EA0' },
    { id: 'rose', label: 'Rose', accent: '#D1618F' },
    { id: 'indigo', label: 'Indigo', accent: '#6C7BD1' },
    { id: 'copper', label: 'Copper', accent: '#C97D4F' },
    { id: 'navy', label: 'Navy', accent: '#1F3A68' },
    { id: 'leafs', label: 'Leafs blue', accent: '#00205B' },
    { id: 'habs', label: 'Habs bleu-blanc-rouge', accent: '#AF1E2D', accent2: '#192168' },
    { id: 'packers', label: 'Packers green & gold', accent: '#203731', accent2: '#FFB612' },
    { id: 'steelers', label: 'Steelers black & gold', accent: '#FFB612', accent2: '#101820' },
    { id: 'ferrari', label: 'Ferrari rosso', accent: '#DC0000', accent2: '#FFF200' },
    { id: 'mclaren', label: 'McLaren papaya', accent: '#FF8000', accent2: '#47C7FC' },
    // Secret colours (hidden: true) — not listed for everyone; the Super Admin
    // sees them now, others will unlock them through achievements. `text`
    // forces the banner lettering (Hot Dog Stand must be yellow on red).
    { id: 'hotdog', label: 'Hot Dog Stand', accent: '#FF0000', accent2: '#FFFF00', text: '#FFFF00', hidden: true },
    { id: 'miamivice', label: 'Miami Vice', accent: '#0BBFB0', accent2: '#FF5DA2', hidden: true },
    { id: 'vaporwave', label: 'Vaporwave', accent: '#FF71CE', accent2: '#01CDFE', hidden: true },
  ];

  // ---------- colour maths ----------
  function rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(c) {
    return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join('');
  }
  // t of a + (1 - t) of b
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex([0, 1, 2].map(function (i) { return x[i] * t + y[i] * (1 - t); }));
  }
  function lum(c) {
    var v = rgb(c).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // Push a colour toward white (dark mode) or black (light mode) until it
  // reads against the background — so Leafs navy works on dark, gold on light.
  function readable(c, bg, toward, min) {
    var out = c;
    for (var i = 0; i < 20 && contrast(out, bg) < min; i++) out = mix(toward, out, 0.12);
    return out;
  }

  // Best lettering for a fill: the second colour if it reads well on it
  // (Packers gold on green), else white or near-black, whichever is stronger.
  function letteringFor(fill, preferred) {
    if (preferred && contrast(preferred, fill) >= 4.5) return preferred;
    return contrast(fill, '#FFFFFF') >= contrast(fill, '#111315') ? '#FFFFFF' : '#111315';
  }

  // Quiet roles (app default colour): the look apps already have.
  function quietRoles(p) {
    return {
      '--header-bg': p['--bg-header'], '--header-text': p['--text-primary'], '--header-text-muted': p['--text-secondary'],
      '--header-name': p['--accent'], '--header-strip': p['--accent-2'],
      '--btn-bg': p['--accent'], '--btn-text': p['--accent-contrast'],
      '--btn-2-bg': p['--bg-card'], '--btn-2-text': p['--text-secondary'], '--btn-2-border': p['--border-input'],
      '--tab-bg': p['--bg-card'], '--tab-text': p['--text-secondary'], '--tab-border': p['--border-color'],
      '--tab-active-bg': p['--accent-soft'], '--tab-active-text': p['--accent'], '--tab-active-border': p['--accent'],
      '--title-color': p['--text-tertiary'], '--badge-bg': 'transparent', '--badge-text': p['--accent'],
    };
  }

  // Bold roles (a colour the person chose): the colour takes over.
  function boldRoles(p, rawAccent, rawAccent2, mode, forcedText) {
    var main = rawAccent;                         // the team/brand colour as-is for fills
    var second = rawAccent2 || mix(rawAccent, mode === 'light' ? '#000000' : '#000000', 0.70);
    var headerText = forcedText || letteringFor(main, rawAccent2);
    var secondText = letteringFor(second, rawAccent);
    var soft = mix(main, p['--bg-card'], mode === 'light' ? 0.22 : 0.30);
    return {
      '--header-bg': main, '--header-text': headerText, '--header-text-muted': mix(headerText, main, 0.75),
      '--header-name': headerText, '--header-strip': second,
      '--btn-bg': main, '--btn-text': letteringFor(main, null),
      '--btn-2-bg': soft, '--btn-2-text': letteringFor(soft, null), '--btn-2-border': 'transparent',
      '--tab-bg': soft, '--tab-text': letteringFor(soft, null), '--tab-border': 'transparent',
      '--tab-active-bg': second, '--tab-active-text': secondText, '--tab-active-border': second,
      '--title-color': p['--accent'], '--badge-bg': second, '--badge-text': secondText,
    };
  }

  function palette(accentHex, accent2Hex, mode, bold, forcedText) {
    var dark = mode !== 'light';
    var p = {};
    if (dark) {
      p['--bg-page'] = mix(accentHex, '#16181A', 0.06);
      p['--bg-card'] = mix(accentHex, '#212427', 0.08);
      p['--bg-input'] = p['--bg-page'];
      p['--bg-header'] = mix(accentHex, '#121416', 0.10);
      p['--bg-hover'] = mix(accentHex, '#2A2E31', 0.10);
      p['--border-color'] = mix(accentHex, '#33373B', 0.15);
      p['--border-input'] = mix(accentHex, '#454A4E', 0.15);
      p['--text-primary'] = '#ECEDEE';
      p['--text-secondary'] = mix(accentHex, '#8E959B', 0.15);
      p['--text-tertiary'] = '#5F6569';
      var a = readable(accentHex, p['--bg-card'], '#FFFFFF', 4.5);
      p['--accent'] = a;
      p['--accent-dark'] = mix(a, '#000000', 0.80);
      p['--accent-soft'] = mix(a, p['--bg-card'], 0.18);
      p['--accent-2'] = readable(accent2Hex || a, p['--bg-header'], '#FFFFFF', 3);
      p['--red'] = '#E06666'; p['--green'] = '#6FB35C'; p['--yellow'] = '#D1A93F';
      p['--shadow-sm'] = '0 1px 3px rgba(0,0,0,0.35)';
      p['--shadow-md'] = '0 4px 6px rgba(0,0,0,0.35)';
    } else {
      p['--bg-page'] = mix(accentHex, '#F3F4F5', 0.05);
      p['--bg-card'] = '#FFFFFF';
      p['--bg-input'] = '#FFFFFF';
      p['--bg-header'] = mix(accentHex, '#FAFAFB', 0.06);
      p['--bg-hover'] = mix(accentHex, '#F1F2F3', 0.08);
      p['--border-color'] = mix(accentHex, '#D9DDE1', 0.12);
      p['--border-input'] = mix(accentHex, '#C4C9CE', 0.12);
      p['--text-primary'] = '#1D2125';
      p['--text-secondary'] = '#5D656C';
      p['--text-tertiary'] = '#8A9096';
      var b = readable(accentHex, '#FFFFFF', '#000000', 4.5);
      p['--accent'] = b;
      p['--accent-dark'] = mix(b, '#000000', 0.82);
      p['--accent-soft'] = mix(b, '#FFFFFF', 0.12);
      p['--accent-2'] = readable(accent2Hex || b, p['--bg-header'], '#000000', 3);
      p['--red'] = '#B33A3A'; p['--green'] = '#3B7D2B'; p['--yellow'] = '#8A6A12';
      p['--shadow-sm'] = '0 1px 3px rgba(0,0,0,0.10)';
      p['--shadow-md'] = '0 4px 10px rgba(0,0,0,0.10)';
    }
    p['--accent-rgb'] = rgb(p['--accent']).join(', ');
    p['--accent-contrast'] = contrast(p['--accent'], '#000000') >= contrast(p['--accent'], '#FFFFFF') ? '#111315' : '#FFFFFF';
    p['--red-light'] = mix(p['--red'], p['--bg-card'], 0.12);
    p['--red-border'] = mix(p['--red'], p['--bg-card'], 0.45);
    p['--green-light'] = mix(p['--green'], p['--bg-card'], 0.12);
    p['--yellow-light'] = mix(p['--yellow'], p['--bg-card'], 0.12);
    var roles = bold ? boldRoles(p, accentHex, accent2Hex, dark ? 'dark' : 'light', forcedText) : quietRoles(p);
    for (var r in roles) p[r] = roles[r];
    return p;
  }

  // ---------- applying ----------
  var current = null; // { app, defaultAccent, user }
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function resolveMode(user) {
    var m = user && user.themeMode;
    if (m === 'dark' || m === 'light') return m;
    return media && media.matches ? 'light' : 'dark';
  }
  function presetFor(app, user) {
    var map = (user && user.themeAccent) || {};
    if (typeof map === 'string') map = { HELM: map }; // pre-per-app shape
    var id = map[String(app || '').toUpperCase()];
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }

  function paint(opts) {
    var preset = presetFor(opts.app, opts.user);
    var mode = resolveMode(opts.user);
    var p = palette(preset ? preset.accent : (opts.defaultAccent || '#9BA8B5'), preset ? preset.accent2 : null, mode, !!preset, preset ? preset.text : null);
    var root = document.documentElement;
    for (var k in p) root.style.setProperty(k, p[k]);
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-accent', preset ? 'bold' : 'default');
    root.style.colorScheme = mode;
    return { mode: mode, preset: preset ? preset.id : null };
  }

  function apply(opts) {
    current = { app: opts.app, defaultAccent: opts.defaultAccent, user: opts.user || null };
    return paint(current);
  }

  // Signed out: drop the person's choices, keep the app default + device mode.
  function reset() {
    if (!current) return;
    current = { app: current.app, defaultAccent: current.defaultAccent, user: null };
    paint(current);
  }

  // Follow the device when someone's mode is "system".
  if (media) {
    var onChange = function () { if (current) paint(current); };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  window.EinbauTheme = {
    version: '2026-10-28',
    PRESETS: PRESETS,
    MODES: [
      { id: 'system', label: 'Match my device' },
      { id: 'dark', label: 'Dark' },
      { id: 'light', label: 'Light' },
    ],
    apply: apply,
    reset: reset,
    palette: function (presetIdOrHex, mode) {
      var pr = null;
      for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === presetIdOrHex) pr = PRESETS[i];
      return palette(pr ? pr.accent : presetIdOrHex, pr ? pr.accent2 : null, mode || 'dark', !!pr, pr ? pr.text : null);
    },
  };
})();
