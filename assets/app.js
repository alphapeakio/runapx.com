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
  var N = 18;             /* treads */
  var RISE = 30;          /* px of climb per tread */
  var RADIUS = 190;       /* px from the newel post */
  var STEP = 360 / N;     /* degrees between treads → seamless wrap */
  var TILT = 66;          /* how flat each tread lies */
  var H = N * RISE;       /* full helix height */
  var treads = [];

  if (helix) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < N; i++) {
      var t = document.createElement('span');
      t.className = 'tread';
      var y0 = i * RISE;
      t.style.setProperty('--a', (i * STEP) + 'deg');
      t.style.setProperty('--y', (H / 2 - y0).toFixed(1) + 'px');
      t.style.opacity = (0.14 + 0.86 * Math.sin(Math.PI * (y0 / H))).toFixed(3);
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

    /* ── The Ascent: the spiral staircase turns slowly on its own —
       no scroll-linked acceleration. ── */
    if (helix && treads.length) {
      var climb = elapsed * 16;                        /* steady, gentle climb */
      for (var k = 0; k < treads.length; k++) {
        var y = mod(k * RISE + climb, H);              /* rises, wraps seamlessly */
        var ang = (y / RISE) * STEP;
        var op = Math.sin(Math.PI * (y / H));          /* fade at the wrap points */
        treads[k].style.transform =
          'rotateY(' + ang.toFixed(2) + 'deg) translateZ(' + RADIUS + 'px) ' +
          'translateY(' + (H / 2 - y).toFixed(1) + 'px) rotateX(' + TILT + 'deg)';
        treads[k].style.opacity = (0.10 + 0.90 * op).toFixed(3);
      }
    }

    /* ── Aerial background track: stays fully hidden until the helix has
       scrolled off the screen, so the two never overlap. ── */
    if (trackView && stair) {
      var stairEnd = stair.offsetTop + stair.offsetHeight;
      trackView.style.opacity =
        clamp((window.scrollY - stairEnd) / (vh * 0.5), 0, 1).toFixed(3);
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
