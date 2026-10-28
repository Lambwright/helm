/* Einbau suite — seasonal decorations + the shared Claude loading animation.
 * ONE file every app loads (next to einbau-theme.js), served by HELM at
 *   https://lambwright.github.io/helm/einbau-festive.js
 *
 *   EinbauFestive.init({ app: 'TALLY' })          // once, after the page loads
 *   const l = EinbauFestive.loader(el, { size })  // anything loading → l.done() / l.stalled() / l.remove()
 *   EinbauFestive.phrase()                        // a loading line for the season, if you need text only
 *
 * Seasons switch on by date: Halloween Oct 15 – Nov 1, Christmas Dec 1 – Dec 26.
 * Preview / override on one browser: ?festive=halloween|christmas|off in the URL
 * (remembered on that browser; ?festive=auto goes back to the calendar). Decorations never take clicks
 * (pointer-events: none), sit behind dialogs, and hold still for anyone whose
 * device asks for reduced motion.
 */
(function () {
  'use strict';

  var KEY = 'einbau_festive';

  function season() {
    try {
      var q = new URLSearchParams(location.search).get('festive');
      if (q === 'auto') localStorage.removeItem(KEY);
      else if (q) localStorage.setItem(KEY, q);
      if (q && history.replaceState) {
        // Remembered now — take it back out of the address bar.
        var u = new URL(location.href);
        u.searchParams.delete('festive');
        history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      }
      var forced = localStorage.getItem(KEY);
      if (forced === 'off') return null;
      if (forced === 'halloween' || forced === 'christmas') return forced;
    } catch (e) { /* private mode etc. */ }
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    if ((m === 10 && day >= 15) || (m === 11 && day <= 1)) return 'halloween';
    if (m === 12 && day <= 26) return 'christmas';
    return null;
  }

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------- loading phrases ----------
  var PHRASES = {
    normal: ['Working on it…', 'Crunching the numbers…', 'Fetching the good stuff…', 'Reading the fine print…', 'Lining things up…', 'Almost there…'],
    halloween: ['Summoning your data…', 'Raising the invoices from the dead…', 'Stitching the records together…', 'Consulting the spirits of Procore…', "It's alive! Almost…", 'Rattling the NetSuite bones…', 'Brewing the numbers in the cauldron…', 'Carving up the line items…', 'Waking the ghosts in the machine…', 'Something wicked this way loads…'],
    christmas: ['Checking the list twice…', 'Wrapping up your data…', 'Loading the sleigh…', 'The elves are on it…', 'Dashing through the records…', 'Warming up by the fire…', 'Untangling the lights…', 'Feeding the reindeer…'],
  };
  function phrase() {
    var list = PHRASES[season() || 'normal'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- artwork ----------
  var BAT = '<svg viewBox="0 0 64 28" xmlns="http://www.w3.org/2000/svg"><path class="ef-wing" d="M32 10c-2-4-5-6-9-6 1 2 1 4 0 6-3-3-8-4-12-3 2 2 3 4 3 7-4-1-9 0-12 3 5 0 9 2 12 5 3-2 7-3 11-2 2 1 4 3 5 5 1-2 3-4 5-5 4-1 8 0 11 2 3-3 7-5 12-5-3-3-8-4-12-3 0-3 1-5 3-7-4-1-9 0-12 3-1-2-1-4 0-6-4 0-7 2-9 6z" fill="currentColor"/><circle cx="29.5" cy="12" r="0.9" fill="#ffcf4a"/><circle cx="34.5" cy="12" r="0.9" fill="#ffcf4a"/></svg>';
  function web(size) {
    // A corner cobweb: spokes from the corner plus sagging threads between them.
    var s = size, spokes = [0, 18, 36, 54, 72, 90], rings = [0.22, 0.42, 0.62, 0.82, 1];
    var d = '';
    spokes.forEach(function (a) {
      var r = a * Math.PI / 180;
      d += 'M0 0L' + (Math.cos(r) * s).toFixed(1) + ' ' + (Math.sin(r) * s).toFixed(1);
    });
    rings.forEach(function (k) {
      for (var i = 0; i < spokes.length - 1; i++) {
        var a1 = spokes[i] * Math.PI / 180, a2 = spokes[i + 1] * Math.PI / 180, am = (a1 + a2) / 2;
        var x1 = Math.cos(a1) * s * k, y1 = Math.sin(a1) * s * k, x2 = Math.cos(a2) * s * k, y2 = Math.sin(a2) * s * k;
        var cx = Math.cos(am) * s * k * 0.78, cy = Math.sin(am) * s * k * 0.78;
        d += 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
      }
    });
    return '<svg viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>'
      + '<g class="ef-spider"><line x1="' + (s * 0.55) + '" y1="' + (s * 0.3) + '" x2="' + (s * 0.55) + '" y2="' + (s * 0.55) + '" stroke="currentColor" stroke-width="0.8"/><circle cx="' + (s * 0.55) + '" cy="' + (s * 0.58) + '" r="3.2" fill="currentColor"/></g></svg>';
  }

  // The typing creature (TALLY's ClaudeTyping, shared). Costumes per season.
  function creature(costume) {
    var body = '#D97757', bodyDark = '#C4684A', legs = '#B85F3E', hands = '#E89170';
    var extra = '', screen = '#6FB35C', monitorExtra = '';
    if (costume === 'halloween') {
      body = '#7FA35F'; bodyDark = '#6A8C4E'; legs = '#4A3B2A'; hands = '#8FB46E';
      extra = '<rect x="30" y="56" width="44" height="9" rx="1" fill="#1B1B1B"/>'                       // flat-top hair
        + '<rect x="27" y="80" width="6" height="5" rx="1" fill="#8A8F94"/><rect x="71" y="80" width="6" height="5" rx="1" fill="#8A8F94"/>' // neck bolts
        + '<path d="M38 68h26M42 66v4M48 66v4M54 66v4M60 66v4" stroke="#2A1A12" stroke-width="1.2"/>'; // forehead stitches
      monitorExtra = '<path d="M112 46l22 0M112 46l0 22M112 46l18 18M112 52q6 1 6-6M112 58q12 2 12-12M112 64q17 3 17-18" stroke="#E8E6E0" stroke-width="0.8" fill="none" opacity="0.9"/>'
        + '<path d="M188 46l-16 0M188 46l0 16M188 46l-12 12M188 51q-5 0-5-5M188 57q-10 0-10-11" stroke="#E8E6E0" stroke-width="0.8" fill="none" opacity="0.9"/>';
      screen = '#9BE36A';
    } else if (costume === 'christmas') {
      extra = '<path d="M30 64 L52 36 L74 64 Z" fill="#C8102E"/><rect x="28" y="60" width="48" height="7" rx="3.5" fill="#F4F4F4"/><circle cx="52" cy="35" r="5" fill="#F4F4F4"/>'; // santa hat
      monitorExtra = '<path d="M114 44 q8 -6 16 0 q8 6 16 0 q8 -6 16 0 q8 6 16 0" stroke="#2E8B57" stroke-width="3" fill="none"/><circle cx="122" cy="44" r="2" fill="#E74C3C"/><circle cx="138" cy="44" r="2" fill="#F1C40F"/><circle cx="154" cy="44" r="2" fill="#3498DB"/><circle cx="170" cy="44" r="2" fill="#E74C3C"/>';
    }
    return '<svg class="ef-cc" viewBox="0 0 200 124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Working on it">'
      + '<rect x="0" y="108" width="200" height="2" fill="#3A3733"/>'
      + '<rect x="112" y="46" width="76" height="62" rx="5" fill="#CDBF9F"/><rect x="112" y="102" width="76" height="6" fill="#B3A583"/>'
      + '<rect x="119" y="53" width="62" height="43" rx="3" fill="#0E1A12"/>'
      + '<g class="ef-screen">'
      + [60, 67, 74, 81].map(function (y, i) { return '<rect class="ef-line l' + (i + 1) + '" x="124" y="' + y + '" width="50" height="3" fill="' + screen + '"/>'; }).join('')
      + '<rect class="ef-cursor" x="124" y="88" width="6" height="4" fill="' + screen + '"/></g>'
      + '<polyline class="ef-check" points="135,76 146,88 166,64" fill="none" stroke="' + screen + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
      + monitorExtra
      + '<rect x="82" y="100" width="48" height="8" rx="1.5" fill="#CDBF9F"/><g fill="#8E8268"><rect x="86" y="102" width="5" height="2"/><rect x="94" y="102" width="5" height="2"/><rect x="102" y="102" width="5" height="2"/><rect x="110" y="102" width="5" height="2"/><rect x="118" y="102" width="5" height="2"/></g>'
      + '<g class="ef-char"><rect x="42" y="100" width="30" height="8" rx="2" fill="' + legs + '"/>'
      + '<rect x="32" y="62" width="40" height="42" rx="6" fill="' + body + '"/>'
      + '<rect class="ef-eye" x="41" y="72" width="6" height="10" rx="1.5" fill="#2A1A12"/><rect class="ef-eye" x="56" y="72" width="6" height="10" rx="1.5" fill="#2A1A12"/>'
      + extra
      + '<rect class="ef-arm ef-arm-a" x="68" y="86" width="15" height="5" rx="2.5" fill="' + body + '"/><circle class="ef-arm ef-arm-a" cx="84" cy="88.5" r="3" fill="' + hands + '"/>'
      + '<rect class="ef-arm ef-arm-b" x="68" y="93" width="19" height="5" rx="2.5" fill="' + bodyDark + '"/><circle class="ef-arm ef-arm-b" cx="88" cy="95.5" r="3" fill="' + hands + '"/></g>'
      + '<text class="ef-question" x="62" y="52" font-size="20" font-weight="700" fill="#D1A93F">?</text>'
      + '</svg>';
  }

  // ---------- styles ----------
  var CSS = ''
    + '.ef-deco{position:fixed;pointer-events:none;z-index:250;color:#d8d8d8;opacity:.42}'
    + '[data-theme="light"] .ef-deco{color:#555;opacity:.5}'
    + '.ef-web{width:var(--ef-s);height:var(--ef-s)}'
    + '.ef-web.tl{top:0;left:0}.ef-web.tr{top:0;right:0;transform:scaleX(-1)}.ef-web.bl{bottom:0;left:0;transform:scaleY(-1)}.ef-web.br{bottom:0;right:0;transform:scale(-1,-1)}'
    + '.ef-mini{position:absolute;pointer-events:none;z-index:5;width:var(--ef-s);height:var(--ef-s);color:#d8d8d8;opacity:.55;line-height:0}'
    + '[data-theme="light"] .ef-mini{color:#555;opacity:.55}'
    + '.ef-mini.tl{top:-3px;left:-3px}.ef-mini.tr{top:-3px;right:-3px;transform:scaleX(-1)}.ef-mini.bl{bottom:-3px;left:-3px;transform:scaleY(-1)}.ef-mini.br{bottom:-3px;right:-3px;transform:scale(-1,-1)}'
    + '.ef-mini .ef-spider{display:none}'
    + '.ef-bats{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:-1}'
    + '.ef-band .ef-bats{z-index:0}'
    + '.ef-band{position:fixed;left:0;right:0;height:56px;pointer-events:none;z-index:240}.ef-band.bottom{bottom:0}'
    + '.ef-bat{position:absolute;color:#0b0b0d;opacity:.95}'
    + '[data-theme="dark"] .ef-bat{filter:drop-shadow(0 0 3px rgba(255,140,30,.75)) drop-shadow(0 0 1px rgba(255,140,30,.9))}'
    + '.ef-bat svg{display:block;width:100%;height:auto}'
    + '.ef-anim .ef-bat .ef-wing{transform-origin:50% 40%;animation:ef-flap var(--ef-f,0.5s) ease-in-out infinite alternate}'
    + '.ef-anim .ef-bat{animation:ef-drift var(--ef-d,6s) ease-in-out infinite alternate}'
    + '.ef-anim .ef-spider{animation:ef-spider 5s ease-in-out infinite}'
    + '@keyframes ef-flap{from{transform:scaleY(1)}to{transform:scaleY(.45)}}'
    + '@keyframes ef-drift{from{transform:translate(0,0) scaleX(var(--ef-x,1))}to{transform:translate(var(--ef-dx,14px),var(--ef-dy,-4px)) scaleX(var(--ef-x,1))}}'
    + '@keyframes ef-spider{0%,100%{transform:translateY(0)}50%{transform:translateY(10px)}}'
    + '.ef-snow{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}'
    + '.ef-flake{position:absolute;top:-10px;color:#fff;opacity:.8;animation:ef-fall linear infinite}'
    + '[data-theme="light"] .ef-flake{color:#9fb7cf}'
    + '@keyframes ef-fall{to{transform:translate(var(--ef-dx,20px),105vh)}}'
    // loader
    + '.ef-loader{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px;color:var(--text-secondary,#999);font-size:12px;text-align:center}'
    + '.ef-cc{display:block;overflow:visible}.ef-cc *{transform-box:fill-box}'
    + '.ef-check,.ef-question{opacity:0}'
    + '.ef-anim .ef-line{transform-origin:left center;animation:ef-line 1.7s ease-in-out infinite}'
    + '.ef-anim .ef-line.l2{animation-delay:-.4s}.ef-anim .ef-line.l3{animation-delay:-.9s}.ef-anim .ef-line.l4{animation-delay:-1.3s}'
    + '.ef-anim .ef-cursor{animation:ef-blink .7s steps(1) infinite}'
    + '.ef-anim .ef-arm-a{animation:ef-type .26s ease-in-out infinite alternate}'
    + '.ef-anim .ef-arm-b{animation:ef-type .26s ease-in-out -.13s infinite alternate}'
    + '.ef-anim .ef-char{animation:ef-bob 1.2s ease-in-out infinite}'
    + '@keyframes ef-line{0%,100%{transform:scaleX(.25)}50%{transform:scaleX(1)}}'
    + '@keyframes ef-blink{50%{opacity:0}}@keyframes ef-type{from{transform:translateY(0)}to{transform:translateY(-4px)}}'
    + '@keyframes ef-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}'
    + '.ef-loader.is-done .ef-line,.ef-loader.is-done .ef-cursor{opacity:0;animation:none}.ef-loader.is-done .ef-check{opacity:1}'
    + '.ef-loader.is-done .ef-arm-a,.ef-loader.is-done .ef-arm-b,.ef-loader.is-done .ef-char{animation:none}'
    + '.ef-loader.is-stalled .ef-line,.ef-loader.is-stalled .ef-cursor,.ef-loader.is-stalled .ef-arm-a,.ef-loader.is-stalled .ef-arm-b,.ef-loader.is-stalled .ef-char{animation:none}'
    + '.ef-loader.is-stalled .ef-question{opacity:1}';

  function injectCss() {
    if (document.getElementById('ef-css')) return;
    var st = document.createElement('style');
    st.id = 'ef-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function batsInto(container, count, sizeRange) {
    var layer = document.createElement('div');
    layer.className = 'ef-bats';
    layer.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < count; i++) {
      var b = document.createElement('div');
      b.className = 'ef-bat';
      var w = rnd(sizeRange[0], sizeRange[1]);
      b.style.width = w + 'px';
      b.style.left = rnd(4, 92) + '%';
      b.style.top = rnd(8, 62) + '%';
      b.style.setProperty('--ef-x', Math.random() < 0.5 ? '-1' : '1');
      b.style.setProperty('--ef-f', rnd(0.35, 0.7).toFixed(2) + 's');
      b.style.setProperty('--ef-d', rnd(4, 9).toFixed(1) + 's');
      b.style.setProperty('--ef-dx', rnd(-24, 24).toFixed(0) + 'px');
      b.style.setProperty('--ef-dy', rnd(-8, 8).toFixed(0) + 'px');
      b.innerHTML = BAT;
      layer.appendChild(b);
    }
    container.appendChild(layer);
  }

  // Small cobwebs tucked into the corners of page elements (Ben, 2026-10-28):
  // always the app's logo/title and the end of its tab bar, plus a few random
  // cards/panels; anything marked data-einbau-web="tl|tr|bl|br" always gets one.
  // Re-checked as screens change, so new views get webs too.
  function miniWeb(el, corner, size) {
    if (!el || el.querySelector(':scope > .ef-mini')) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    var d = document.createElement('span');
    d.className = 'ef-mini ' + corner;
    d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--ef-s', size + 'px');
    d.innerHTML = web(size);
    el.appendChild(d);
  }
  var CORNERS = ['tl', 'tr', 'bl', 'br'];
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function sprinkle() {
    document.querySelectorAll('[data-einbau-web]').forEach(function (el) {
      var c = el.getAttribute('data-einbau-web');
      miniWeb(el, CORNERS.indexOf(c) >= 0 ? c : 'tr', Math.round(rnd(22, 34)));
    });
    var logo = document.querySelector('[data-einbau-logo], .header-badge, .app-switcher, header h1, .header h1, .logo, .brand');
    miniWeb(logo, 'tr', Math.round(rnd(30, 42)));
    document.querySelectorAll('.tabs, [role="tablist"], .tab-bar, nav.tabs').forEach(function (bar) {
      var last = bar.lastElementChild;
      while (last && last.classList && last.classList.contains('ef-mini')) last = last.previousElementSibling;
      miniWeb(last, 'tr', Math.round(rnd(24, 34)));
    });
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card, .panel, [data-einbau-card]'))
      .filter(function (c) { return !c.querySelector(':scope > .ef-mini') && c.offsetWidth > 120; });
    var already = document.querySelectorAll('.card > .ef-mini, .panel > .ef-mini, [data-einbau-card] > .ef-mini').length;
    for (var i = already; i < 3 && cards.length; i++) {
      var c = cards.splice(Math.floor(Math.random() * cards.length), 1)[0];
      miniWeb(c, pick(CORNERS), Math.round(rnd(26, 40)));
    }
  }
  function watchForNewScreens() {
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; sprinkle(); }, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }

  var initialised = false;
  function init(opts) {
    if (initialised) return;
    var s = season();
    injectCss();
    if (!reduced) document.documentElement.classList.add('ef-anim');
    if (!s) return;
    initialised = true;
    var go = function () {
      if (s === 'halloween') {
        ['tl', 'tr', 'bl', 'br'].forEach(function (c) {
          var size = Math.round(rnd(110, 180));
          var d = document.createElement('div');
          d.className = 'ef-deco ef-web ' + c;
          d.style.setProperty('--ef-s', size + 'px');
          d.setAttribute('aria-hidden', 'true');
          d.innerHTML = web(size);
          document.body.appendChild(d);
        });
        // Bats in the app's header (first match), else a band across the top;
        // and a band along the bottom (the "footer").
        var sel = (opts && opts.header) || '[data-einbau-header], header, .header, .app-header';
        var header = document.querySelector(sel);
        if (header) {
          if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
          header.style.isolation = 'isolate'; // bats fly behind the header's text and buttons
          batsInto(header, Math.round(rnd(4, 7)), [26, 52]);
        } else {
          var top = document.createElement('div');
          top.className = 'ef-band';
          top.style.top = '0';
          document.body.appendChild(top);
          batsInto(top, Math.round(rnd(4, 7)), [26, 48]);
        }
        var bottom = document.createElement('div');
        bottom.className = 'ef-band bottom';
        document.body.appendChild(bottom);
        batsInto(bottom, Math.round(rnd(3, 5)), [22, 40]);
        sprinkle();
        watchForNewScreens();
      } else if (s === 'christmas') {
        var snow = document.createElement('div');
        snow.className = 'ef-snow';
        snow.setAttribute('aria-hidden', 'true');
        var n = reduced ? 0 : 28;
        for (var i = 0; i < n; i++) {
          var f = document.createElement('div');
          f.className = 'ef-flake';
          f.textContent = '❄';
          f.style.left = rnd(0, 100) + '%';
          f.style.fontSize = rnd(8, 16).toFixed(0) + 'px';
          f.style.animationDuration = rnd(9, 20).toFixed(1) + 's';
          f.style.animationDelay = (-rnd(0, 20)).toFixed(1) + 's';
          f.style.setProperty('--ef-dx', rnd(-40, 40).toFixed(0) + 'px');
          snow.appendChild(f);
        }
        document.body.appendChild(snow);
      }
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }

  // A loading animation in `el` (replaces its contents). Returns controls.
  function loader(el, opts) {
    injectCss();
    if (!reduced) document.documentElement.classList.add('ef-anim');
    opts = opts || {};
    var size = opts.size || 150;
    var wrap = document.createElement('div');
    wrap.className = 'ef-loader is-working';
    wrap.setAttribute('role', 'status');
    wrap.innerHTML = '<div style="width:' + size + 'px">' + creature(season()) + '</div><div class="ef-text"></div>';
    var text = wrap.querySelector('.ef-text');
    text.textContent = opts.text || phrase();
    el.innerHTML = '';
    el.appendChild(wrap);
    var timer = opts.text ? null : setInterval(function () { text.textContent = phrase(); }, 2600);
    function stop() { if (timer) clearInterval(timer); timer = null; }
    return {
      element: wrap,
      done: function (msg) { stop(); wrap.className = 'ef-loader is-done'; if (msg) text.textContent = msg; },
      stalled: function (msg) { stop(); wrap.className = 'ef-loader is-stalled'; if (msg) text.textContent = msg; },
      setText: function (msg) { stop(); text.textContent = msg; },
      remove: function () { stop(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); },
    };
  }

  window.EinbauFestive = {
    version: '2026-10-28b',
    season: season,
    init: init,
    loader: loader,
    phrase: phrase,
    creatureSvg: function () { return creature(season()); },
    // Put a small cobweb in a corner of one element yourself (Halloween only).
    web: function (el, corner) { if (season() === 'halloween') { injectCss(); miniWeb(el, corner || 'tr', 30); } },
  };
})();
