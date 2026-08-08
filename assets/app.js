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

  if (reduce) return; /* everything below is pure motion */

  var panes = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
  var stair = document.querySelector('.stair');

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

    /* ── The Ascent: scrolling down climbs the staircase up ── */
    if (helix && treads.length) {
      var scrollClimb = 0;
      if (stair) {
        var sr = stair.getBoundingClientRect();
        var dist = stair.offsetHeight - vh;           /* pinned travel */
        var scrolled = clamp(-sr.top, 0, dist);
        var prog = dist > 0 ? scrolled / dist : 0;    /* 0..1 through the section */
        scrollClimb = prog * H * 3.2;                 /* ~3 revolutions of climb */
      }
      var climb = elapsed * 9 + scrollClimb;          /* gentle idle + scroll */
      for (var k = 0; k < treads.length; k++) {
        var y = mod(k * RISE + climb, H);             /* rises, wraps seamlessly */
        var ang = (y / RISE) * STEP;
        var op = Math.sin(Math.PI * (y / H));         /* fade at the wrap points */
        treads[k].style.transform =
          'rotateY(' + ang.toFixed(2) + 'deg) translateZ(' + RADIUS + 'px) ' +
          'translateY(' + (H / 2 - y).toFixed(1) + 'px) rotateX(' + TILT + 'deg)';
        treads[k].style.opacity = (0.10 + 0.90 * op).toFixed(3);
      }
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
