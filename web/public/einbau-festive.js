/* Einbau suite — seasonal decorations + the shared Claude loading animation.
 * ONE file every app loads (next to einbau-theme.js), served by HELM at
 *   https://lambwright.github.io/helm/einbau-festive.js
 *
 *   EinbauFestive.init({ app: 'TALLY' })          // once, after the page loads
 *     options for narrow/embedded pages (e.g. the LEDGER Procore sidebar):
 *       bottom: false      — no bats at the foot of the page
 *       bottomZ: 40        — z-index for the bottom-corner webs (e.g. under a
 *                            fixed bottom action bar)
 *       topWebs: false     — no webs in the top corners of the window
 *   EinbauFestive.hide() / .show()  // drop / bring back all decorations, e.g.
 *                                   // hide() on sub-screens, show() on the main menu
 *   "An Einbau Product" anywhere on the page reads "A Spooky Einbau Product"
 *   (Halloween) / "A Festive Einbau Product" (Christmas).
 *   const l = EinbauFestive.loader(el, { size })  // anything loading → l.done() / l.stalled() / l.remove()
 *   EinbauFestive.phrase()                        // a loading line for the season, if you need text only
 *   EinbauFestive.phrase({ short: true })         // one word, for tiny buttons ("Boo…", "Wrapping…")
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
  // One-word lines for tiny buttons ("SAVE", "▶ RUN") where a long line won't fit.
  var SHORT = {
    normal: ['Working…', 'Saving…', 'On it…', 'Busy…'],
    halloween: ['Boo…', 'Brewing…', 'Haunting…', 'Summoning…', 'Stitching…', 'Spooking…'],
    christmas: ['Wrapping…', 'Ho ho ho…', 'Sleighing…', 'Jingling…', 'Elving…'],
  };
  function phrase(opts) {
    var list = ((opts && opts.short) ? SHORT : PHRASES)[season() || 'normal'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- artwork ----------
  // A cartoon bat (Ben's reference): round head with ears, big googly eyes,
  // scalloped wings. Holds still.
  var BAT = '<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M40 14 C30 6 18 4 2 10 C8 14 9 20 7 26 C12 22 17 23 20 28 C23 23 28 23 31 27 C33 23 36 22 40 24 C44 22 47 23 49 27 C52 23 57 23 60 28 C63 23 68 22 73 26 C71 20 72 14 78 10 C62 4 50 6 40 14 Z" fill="currentColor"/>'
    + '<path d="M32 9 L34 1 L38 8 Z M48 9 L46 1 L42 8 Z" fill="currentColor"/>'
    + '<ellipse cx="40" cy="15" rx="9" ry="8.5" fill="currentColor"/>'
    + '<ellipse cx="40" cy="25" rx="6" ry="7" fill="currentColor"/>'
    + '<circle cx="36.3" cy="14" r="3.4" fill="#fff"/><circle cx="43.7" cy="14" r="3.4" fill="#fff"/>'
    + '<circle cx="37" cy="14.6" r="1.6" fill="#111"/><circle cx="43" cy="14.6" r="1.6" fill="#111"/>'
    + '</svg>';

  // Small seeded random generator, so a "random" web is the same web every
  // time for the same seed (same corner → same web on every page and app).
  function seeded(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function yearSeed() { return new Date().getFullYear() * 7 + (season() === 'christmas' ? 3 : 1); }

  // A corner cobweb W×H with its anchor at the top-left; every seed gives a
  // slightly different web (spoke count/angles, ring spacing, sag, a broken
  // thread or two). spider: a still spider hanging off it.
  function web(w, h, seed, spider) {
    var R = seeded(seed || 1);
    h = h || w;
    var n = 5 + Math.floor(R() * 4); // 5–8 spokes
    var spokes = [];
    for (var i = 0; i < n; i++) {
      var base = (90 / (n - 1)) * i, jitter = (i === 0 || i === n - 1) ? 0 : (R() - 0.5) * (60 / n);
      spokes.push((base + jitter) * Math.PI / 180);
    }
    var ringCount = 4 + Math.floor(R() * 3), rings = [], k = 0;
    for (var j = 0; j < ringCount; j++) { k += (1 - k) / (ringCount - j) * (0.75 + R() * 0.5); rings.push(Math.min(k, 1)); }
    var sag = 0.72 + R() * 0.14;
    var pt = function (a, r) { return [Math.cos(a) * w * r, Math.sin(a) * h * r]; };
    var d = '';
    spokes.forEach(function (a) { var p = pt(a, 1); d += 'M0 0L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
    rings.forEach(function (r) {
      for (var i = 0; i < spokes.length - 1; i++) {
        if (R() < 0.07) continue; // a broken thread
        var a1 = spokes[i], a2 = spokes[i + 1], am = (a1 + a2) / 2;
        var p1 = pt(a1, r), p2 = pt(a2, r), c = pt(am, r * (sag + (R() - 0.5) * 0.06));
        d += 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'Q' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
    });
    var sw = (0.8 + R() * 0.35).toFixed(2);
    var sp = '';
    if (spider) {
      var sx = w * (0.45 + R() * 0.2), sy = h * (0.5 + R() * 0.2);
      sp = '<line x1="' + sx.toFixed(1) + '" y1="' + (sy - h * 0.25).toFixed(1) + '" x2="' + sx.toFixed(1) + '" y2="' + sy.toFixed(1) + '" stroke="currentColor" stroke-width="0.8"/>'
        + '<circle cx="' + sx.toFixed(1) + '" cy="' + (sy + 3).toFixed(1) + '" r="3.2" fill="currentColor"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round"/>' + sp + '</svg>';
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
    + '.ef-deco{position:fixed;pointer-events:none;z-index:250;color:#d8d8d8;opacity:.42;line-height:0}'
    + '[data-theme="light"] .ef-deco{color:#555;opacity:.5}'
    + '.ef-web.tl{left:0}.ef-web.tr{right:0;transform:scaleX(-1)}.ef-web.bl{bottom:0;left:0;transform:scaleY(-1)}.ef-web.br{bottom:0;right:0;transform:scale(-1,-1)}'
    + '.ef-mini,.ef-logoweb{position:absolute;pointer-events:none;z-index:5;color:#d8d8d8;opacity:.55;line-height:0}'
    + '[data-theme="light"] .ef-mini,[data-theme="light"] .ef-logoweb{color:#555;opacity:.55}'
    + '.ef-logoweb{z-index:-1}'
    + '.ef-mini.tl{top:-3px;left:-3px}.ef-mini.tr{top:-3px;right:-3px;transform:scaleX(-1)}.ef-mini.bl{bottom:-3px;left:-3px;transform:scaleY(-1)}.ef-mini.br{bottom:-3px;right:-3px;transform:scale(-1,-1)}'
    + '.ef-bats{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:-1}'
    + '.ef-footer{position:relative;height:64px;pointer-events:none;overflow:hidden}.ef-footer .ef-bats{z-index:0}'
    + '.ef-bat{position:absolute;color:#0b0b0d;opacity:.95}'
    + '[data-theme="dark"] .ef-bat{filter:drop-shadow(0 0 3px rgba(255,140,30,.7)) drop-shadow(0 0 1px rgba(255,140,30,.9))}'
    + '.ef-bat svg{display:block;width:100%;height:auto}'
    + '[data-ef-off] .ef-deco,[data-ef-off] .ef-bats,[data-ef-off] .ef-mini,[data-ef-off] .ef-logoweb,[data-ef-off] .ef-footer,[data-ef-off] .ef-snow{display:none!important}'
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

  // Bats in a box, standing still. avoidLeftPx keeps them off the app name.
  function batsInto(container, count, sizeRange, avoidLeftPx) {
    var layer = document.createElement('div');
    layer.className = 'ef-bats';
    layer.setAttribute('aria-hidden', 'true');
    var width = container.clientWidth || window.innerWidth;
    var minLeft = Math.min(85, ((avoidLeftPx || 0) / width) * 100 + 2);
    for (var i = 0; i < count; i++) {
      var b = document.createElement('div');
      b.className = 'ef-bat';
      b.style.width = rnd(sizeRange[0], sizeRange[1]).toFixed(0) + 'px';
      b.style.left = rnd(minLeft, 92).toFixed(1) + '%';
      b.style.top = rnd(10, 55).toFixed(0) + '%';
      b.style.transform = 'rotate(' + rnd(-14, 14).toFixed(0) + 'deg)' + (Math.random() < 0.5 ? ' scaleX(-1)' : '');
      b.innerHTML = BAT;
      layer.appendChild(b);
    }
    container.appendChild(layer);
  }

  // Small cobwebs tucked into the corners of page elements: the end of each tab
  // bar plus a few random cards/panels; anything marked data-einbau-web="tl|tr|bl|br"
  // always gets one. Re-checked as screens change, so new views get webs too.
  function miniWeb(el, corner, size, seed) {
    if (!el || el.querySelector(':scope > .ef-mini')) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    var d = document.createElement('span');
    d.className = 'ef-mini ' + corner;
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = web(size, size, seed || Math.floor(Math.random() * 1e6), false);
    el.appendChild(d);
  }

  // The logo/app-name web: strung from the name's right edge out toward the
  // middle of the screen and down to the header's bottom border, never over
  // the name itself.
  var LOGO_SEL = '[data-einbau-logo], .header-badge, header h1, .header h1, .logo, .brand';
  function logoWeb(header) {
    if (!header || header.querySelector(':scope > .ef-logoweb')) return;
    var logo = header.querySelector(LOGO_SEL);
    if (!logo) return;
    var hr = header.getBoundingClientRect(), lr = logo.getBoundingClientRect();
    var top = Math.max(0, lr.top - hr.top), left = lr.right - hr.left + 4;
    var h = Math.max(24, hr.height - top), w = Math.min(Math.round(h * 1.9), Math.max(40, hr.width / 2 - left));
    var d = document.createElement('span');
    d.className = 'ef-logoweb';
    d.setAttribute('aria-hidden', 'true');
    d.style.top = top.toFixed(0) + 'px';
    d.style.left = left.toFixed(0) + 'px';
    d.innerHTML = web(Math.round(w), Math.round(h), yearSeed() + 101, false);
    header.appendChild(d);
  }

  var CORNERS = ['tl', 'tr', 'bl', 'br'];
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // "An Einbau Product" → "A Spooky / Festive Einbau Product".
  function retag() {
    var to = season() === 'christmas' ? 'A Festive Einbau Product' : 'A Spooky Einbau Product';
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (/^\s*an einbau product\s*$/i.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(/an einbau product/i, to);
    }
  }

  var headerEl = null, headerSel = null;
  // Header bats + the logo web, and the top window webs moved under the
  // header. Retried until the header exists (apps often render it after sign-in).
  function setupHeader() {
    if (headerEl && document.body.contains(headerEl)) return;
    headerEl = document.querySelector(headerSel || '[data-einbau-header], header, .header, .app-header');
    if (!headerEl) return;
    if (getComputedStyle(headerEl).position === 'static') headerEl.style.position = 'relative';
    headerEl.style.isolation = 'isolate'; // behind the header's text and buttons
    var hb = Math.max(0, headerEl.getBoundingClientRect().bottom).toFixed(0) + 'px';
    document.querySelectorAll('.ef-web.tl, .ef-web.tr').forEach(function (w) { w.style.top = hb; });
    var logo = headerEl.querySelector(LOGO_SEL);
    var avoid = logo ? logo.getBoundingClientRect().right - headerEl.getBoundingClientRect().left + 140 : 0;
    batsInto(headerEl, Math.round(rnd(3, 6)), [28, 50], avoid);
  }

  function sprinkle() {
    retag();
    if (season() !== 'halloween') return;
    setupHeader();
    document.querySelectorAll('[data-einbau-web]').forEach(function (el, i) {
      var c = el.getAttribute('data-einbau-web');
      miniWeb(el, CORNERS.indexOf(c) >= 0 ? c : 'tr', Math.round(rnd(18, 27)), yearSeed() + 200 + i);
    });
    if (headerEl) logoWeb(headerEl);
    document.querySelectorAll('.tabs, [role="tablist"], .tab-bar, nav.tabs').forEach(function (bar, i) {
      var last = bar.lastElementChild;
      while (last && last.classList && last.classList.contains('ef-mini')) last = last.previousElementSibling;
      miniWeb(last, 'tr', 24, yearSeed() + 300 + i);
    });
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card, .panel, [data-einbau-card]'))
      .filter(function (c) { return !c.querySelector(':scope > .ef-mini') && c.offsetWidth > 120; });
    var already = document.querySelectorAll('.card > .ef-mini, .panel > .ef-mini, [data-einbau-card] > .ef-mini').length;
    for (var i = already; i < 3 && cards.length; i++) {
      var c = cards.splice(Math.floor(Math.random() * cards.length), 1)[0];
      miniWeb(c, pick(CORNERS), Math.round(rnd(21, 32)));
    }
  }
  function keepFooterLast() {
    var foot = document.querySelector('body > .ef-footer');
    if (foot && foot !== document.body.lastElementChild) document.body.appendChild(foot);
  }
  function watchForNewScreens() {
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () { t = null; sprinkle(); keepFooterLast(); }, 400);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
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
        var bottomZ = opts && typeof opts.bottomZ === 'number' ? String(opts.bottomZ) : null;
        headerSel = opts && opts.header;
        // Window corners: the same four webs on every page and app (seeded per
        // corner), each a little different; top ones start under the header so
        // they never cover the app name; no spiders at the bottom.
        CORNERS.forEach(function (c, i) {
          var top = c === 'tl' || c === 'tr';
          if (top && opts && opts.topWebs === false) return;
          var R = seeded(yearSeed() + i * 17);
          var size = Math.round(88 + R() * 56); // 20% smaller than before
          var d = document.createElement('div');
          d.className = 'ef-deco ef-web ' + c;
          if (top) d.style.top = '0px'; // moved under the header once it exists
          if (bottomZ && !top) d.style.zIndex = bottomZ;
          d.setAttribute('aria-hidden', 'true');
          d.innerHTML = web(size, size, yearSeed() + i * 17 + 5, top);
          document.body.appendChild(d);
        });
        // Footer bats live at the very bottom of the page (scroll to find them),
        // never over the form.
        if (!opts || opts.bottom !== false) {
          var foot = document.createElement('div');
          foot.className = 'ef-footer';
          foot.setAttribute('aria-hidden', 'true');
          document.body.appendChild(foot);
          batsInto(foot, Math.round(rnd(3, 5)), [26, 44], 0);
        }
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
        sprinkle();
        watchForNewScreens();
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
    version: '2026-10-28c',
    season: season,
    init: init,
    loader: loader,
    phrase: phrase,
    creatureSvg: function () { return creature(season()); },
    // Put a small cobweb in a corner of one element yourself (Halloween only).
    web: function (el, corner) { if (season() === 'halloween') { injectCss(); miniWeb(el, corner || 'tr', 24); } },
    // Drop / bring back every decoration (e.g. hide on sub-screens to cut clutter).
    hide: function () { document.documentElement.setAttribute('data-ef-off', ''); },
    show: function () { document.documentElement.removeAttribute('data-ef-off'); },
  };
})();
