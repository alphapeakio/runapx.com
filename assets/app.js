/* ─────────────────────────────────────────────────────────────
   APX — home motion engine (vanilla, no framework, no deps)
   Enhancement only. With JS off, panes are flat and readable and a
   static spiral staircase is shown. This adds:
     · a scroll-driven ASCENT — the spiral staircase climbs upward as
       you scroll down, the opening moment before any content
     · scroll-linked 3D on each frosted pane — it turns, weaves side to
       side, and recedes as it crosses the viewport
     · a cursor / scroll driven light the frosted glass refracts
     · the corner CTA fading in past the hero
   All motion is disabled under prefers-reduced-motion, and the whole
   loop self-pauses while the tab is hidden.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.documentElement;

  /* ── Corner CTA reveal ── */
  var corner = document.querySelector('.corner-cta');
  var hero = document.querySelector('.hero');
  if (corner && hero) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { corner.classList.toggle('show', !e.isIntersecting); });
      }, { threshold: 0 }).observe(hero);
    } else {
      corner.classList.add('show');
    }
  }

  /* ── Build the spiral staircase ──
     N treads on a helix; a full wrap is exactly 360° so the loop is
     seamless. We set a static pose here (used when motion is off) and
     drive it per-frame below when motion is on. */
  var helix = document.getElementById('helix');
  var OV_N = 22;                        /* treads around the oval        */
  var OV_CR = 95;                       /* curve radius (x)              */
  var OV_SL = 150;                      /* straight length (z)           */
  var OV_CURVE = Math.PI * OV_CR;       /* one curve's arc length        */
  var OV_P = 2 * OV_SL + 2 * OV_CURVE;  /* oval perimeter                */
  var OV_SPACING = OV_P / OV_N;
  var OV_TILT = 70;                     /* how flat each tread lies       */
  var LOOP_H = 150;                     /* vertical rise over one lap     */
  var treads = [];

  function wrapP(p) { return ((p % OV_P) + OV_P) % OV_P; }

  /* Point + tangent on the oval (track-shaped) footprint, in the
     horizontal x/z plane. */
  function ovalAt(p) {
    p = wrapP(p);
    var x, z, phi;
    if (p < OV_SL) {                              /* right straight */
      x = OV_CR; z = -OV_SL / 2 + p; phi = 0;
    } else if (p < OV_SL + OV_CURVE) {            /* far curve      */
      var a = (p - OV_SL) / OV_CR;
      x = OV_CR * Math.cos(a); z = OV_SL / 2 + OV_CR * Math.sin(a); phi = a;
    } else if (p < 2 * OV_SL + OV_CURVE) {        /* left straight  */
      x = -OV_CR; z = OV_SL / 2 - (p - (OV_SL + OV_CURVE)); phi = Math.PI;
    } else {                                      /* near curve     */
      var a2 = (p - (2 * OV_SL + OV_CURVE)) / OV_CR;
      x = -OV_CR * Math.cos(a2); z = -OV_SL / 2 - OV_CR * Math.sin(a2); phi = Math.PI + a2;
    }
    return { x: x, z: z, phi: phi * 180 / Math.PI };
  }

  /* Full 3D transform for a tread at perimeter position p — placed on
     the oval, raised by its height in the current lap, laid flat. */
  function treadTransform(p) {
    var o = ovalAt(p);
    var h = wrapP(p) / OV_P * LOOP_H - LOOP_H / 2;
    return 'translate3d(' + o.x.toFixed(1) + 'px,' + (-h).toFixed(1) + 'px,' + o.z.toFixed(1) + 'px) ' +
           'rotateY(' + o.phi.toFixed(1) + 'deg) rotateX(' + OV_TILT + 'deg)';
  }

  if (helix) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < OV_N; i++) {
      var t = document.createElement('span');
      t.className = 'tread';
      var p0 = i * OV_SPACING;
      t.style.transform = treadTransform(p0);
      t.style.opacity = (0.12 + 0.88 * Math.sin(Math.PI * (wrapP(p0) / OV_P))).toFixed(3);
      frag.appendChild(t);
      treads.push(t);
    }
    helix.appendChild(frag);
  }

  /* ── Build the aerial running track ──
     Lanes are concentric stadium rects; app.js pans/banks the field
     along the running line each frame. Drawn now so it also shows
     (static) under reduced motion. */
  var trackField = document.getElementById('trackField');
  var trackRotor = document.getElementById('trackRotor');
  var RR = 300;                       /* running-line radius   */
  var LL = 560;                       /* straight length       */
  var CURVE = Math.PI * RR;           /* one turn's arc length  */
  var LAP = 2 * LL + 2 * CURVE;       /* full perimeter         */
  var SVGNS = 'http://www.w3.org/2000/svg';

  function stadium(r, attrs) {
    var el = document.createElementNS(SVGNS, 'rect');
    el.setAttribute('x', -r);
    el.setAttribute('y', -(LL / 2 + r));
    el.setAttribute('width', 2 * r);
    el.setAttribute('height', LL + 2 * r);
    el.setAttribute('rx', r);
    el.setAttribute('ry', r);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }
  if (trackField) {
    /* Just the lane lines — thin, bright blue, no fill — so the track
       reads as a light backdrop rather than a darkened surface. */
    var lanes = [195, 225, 255, 285, 315, 345, 375, 405];
    for (var li = 0; li < lanes.length; li++) {
      trackField.appendChild(stadium(lanes[li], {
        fill: 'none', stroke: 'rgba(10,160,255,0.5)', 'stroke-width': 2
      }));
    }
    trackField.style.transform = 'translate(-300px, -280px)';        /* static pose */
  }

  /* Position + bank angle at distance s along the running line. */
  function trackAt(s) {
    s = ((s % LAP) + LAP) % LAP;
    var x, y, tx, ty, u, psi;
    if (s < LL) {                              /* right straight, up   */
      x = RR; y = LL / 2 - s; tx = 0; ty = -1;
    } else if (s < LL + CURVE) {               /* top turn             */
      u = s - LL; psi = -(u / RR);
      x = RR * Math.cos(psi); y = -LL / 2 + RR * Math.sin(psi);
      tx = Math.sin(psi); ty = -Math.cos(psi);
    } else if (s < 2 * LL + CURVE) {           /* left straight, down  */
      u = s - (LL + CURVE); x = -RR; y = -LL / 2 + u; tx = 0; ty = 1;
    } else {                                   /* bottom turn          */
      u = s - (2 * LL + CURVE); psi = Math.PI - (u / RR);
      x = RR * Math.cos(psi); y = LL / 2 + RR * Math.sin(psi);
      tx = Math.sin(psi); ty = -Math.cos(psi);
    }
    var phi = Math.atan2(ty, tx) * 180 / Math.PI;
    return { x: x, y: y, a: -90 - phi };       /* a rotates travel to screen-up */
  }

  if (reduce) return; /* everything below is pure motion */

  var panes = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
  var stair = document.querySelector('.stair');
  var stairStage = document.querySelector('.stair-stage');
  var trackView = document.querySelector('.track-view');

  /* cursor light target + eased current, in % */
  var mx = 50, my = 40, cmx = 50, cmy = 40;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (fine) {
    window.addEventListener('pointermove', function (e) {
      mx = (e.clientX / window.innerWidth) * 100;
      my = (e.clientY / window.innerHeight) * 100;
    }, { passive: true });
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function mod(n, m) { return ((n % m) + m) % m; }

  var vh = window.innerHeight;
  window.addEventListener('resize', function () { vh = window.innerHeight; }, { passive: true });

  var t0 = null;

  function frame(ts) {
    if (t0 === null) t0 = ts;
    var elapsed = (ts - t0) / 1000; /* seconds */

    /* eased cursor light for the body bloom */
    cmx += (mx - cmx) * 0.08;
    cmy += (my - cmy) * 0.08;
    root.style.setProperty('--mx', cmx.toFixed(2) + '%');
    root.style.setProperty('--my', cmy.toFixed(2) + '%');

    var center = vh / 2;

    /* Progress through the pinned staircase section, 0..1. */
    var stairProg = 0;
    if (stair) {
      var sr = stair.getBoundingClientRect();
      var dist = stair.offsetHeight - vh;
      stairProg = dist > 0 ? clamp(-sr.top, 0, dist) / dist : 0;
    }

    /* ── The Ascent: an oval track that rises from the bottom and turns
       upward, then hands off to the background track. ── */
    if (helix && treads.length) {
      var enter = clamp(stairProg / 0.32, 0, 1);       /* lift up from the bottom */
      var stageH = stairStage ? stairStage.clientHeight : 420;
      var baseY = (1 - enter) * stageH * 0.55;
      helix.style.transform = 'rotateX(-22deg) translateY(' + baseY.toFixed(1) + 'px)';
      var climb = stairProg * OV_P * 1.6 + elapsed * 18; /* travel the oval + idle */
      for (var k = 0; k < treads.length; k++) {
        var pp = k * OV_SPACING + climb;
        treads[k].style.transform = treadTransform(pp);
        treads[k].style.opacity = (0.10 + 0.90 * Math.sin(Math.PI * (wrapP(pp) / OV_P))).toFixed(3);
      }
    }

    /* ── Aerial background track: hidden during the helix intro, fades
       in once you scroll past it, then runs the lap underfoot. ── */
    if (trackView && stair) {
      var stairEnd = stair.offsetTop + stair.offsetHeight;
      trackView.style.opacity =
        clamp((window.scrollY - (stairEnd - vh)) / (vh * 0.6), 0, 1).toFixed(3);
    }
    if (trackField && trackRotor) {
      var kk = LAP / (vh * 5);               /* slower: ~one lap per 5 viewports */
      var pt = trackAt(window.scrollY * kk + elapsed * 16);
      trackField.style.transform =
        'translate(' + (-pt.x).toFixed(1) + 'px, ' + (-pt.y).toFixed(1) + 'px)';
      trackRotor.style.transform = 'rotate(' + pt.a.toFixed(2) + 'deg) scale(1.7)';
    }

    /* ── Frosted panes: turn + weave + recede as they cross the view ── */
    for (var i = 0; i < panes.length; i++) {
      var el = panes[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;

      var mid = r.top + r.height / 2;
      var p = clamp((mid - center) / center, -1, 1); /* +1 below, -1 above */
      var dir = parseFloat(el.getAttribute('data-dir')) || 1;

      var rotY = (dir * p * 26).toFixed(2);
      var rotX = (-p * 7).toFixed(2);
      var tx = (dir * Math.sin(p * Math.PI / 2) * 7).toFixed(2); /* centred at centre */
      var tz = (-Math.abs(p) * 170).toFixed(0);
      var op2 = (1 - Math.abs(p) * 0.4).toFixed(3);

      el.style.transform =
        'translateX(' + tx + 'vw) translateZ(' + tz + 'px) ' +
        'rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
      el.style.opacity = op2;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
