/* ─────────────────────────────────────────────────────────────
   APX — home motion engine (vanilla, no framework, no deps)
   Enhancement only. With JS off, panes are flat and readable and the
   CSS ambience still plays. This adds:
     · scroll-linked 3D on each glass pane — it turns, weaves side to
       side, and recedes as it passes through the viewport
     · a rotating spiral-staircase helix, wound tighter by scrolling
     · a cursor / scroll driven light that the frosted glass refracts
     · the corner CTA fading in past the hero
   All motion is disabled under prefers-reduced-motion.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.documentElement;

  /* ── Corner CTA reveal (works even without the motion loop) ── */
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

  /* ── Build the spiral staircase ── */
  var helix = document.getElementById('helix');
  var TREADS = 16;
  var STEP_ANGLE = 30;   /* degrees between treads */
  var STEP_RISE = 30;    /* px each tread climbs */
  if (helix) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TREADS; i++) {
      var t = document.createElement('span');
      t.className = 'tread';
      t.style.setProperty('--a', (i * STEP_ANGLE) + 'deg');
      t.style.setProperty('--y', ((i - TREADS / 2) * -STEP_RISE) + 'px');
      /* nearer-to-front treads read brighter */
      t.style.opacity = (0.45 + 0.55 * (i / TREADS)).toFixed(2);
      frag.appendChild(t);
    }
    helix.appendChild(frag);
  }

  if (reduce) return; /* everything below is pure motion */

  var panes = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
  var stairStage = document.querySelector('.stair-stage');

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

  var vh = window.innerHeight;
  window.addEventListener('resize', function () { vh = window.innerHeight; }, { passive: true });

  var t0 = null;

  function frame(ts) {
    if (t0 === null) t0 = ts;
    var elapsed = (ts - t0) / 1000; /* seconds */

    /* eased cursor light for the body bloom + section light fields */
    cmx += (mx - cmx) * 0.08;
    cmy += (my - cmy) * 0.08;
    root.style.setProperty('--mx', cmx.toFixed(2) + '%');
    root.style.setProperty('--my', cmy.toFixed(2) + '%');

    var center = vh / 2;

    /* ── Panes: turn + weave + recede as they cross the viewport ── */
    for (var i = 0; i < panes.length; i++) {
      var el = panes[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue; /* offscreen: skip */

      var mid = r.top + r.height / 2;
      var p = clamp((mid - center) / center, -1, 1); /* +1 below, -1 above */
      var dir = parseFloat(el.getAttribute('data-dir')) || 1;

      var rotY = (dir * p * 26).toFixed(2);
      var rotX = (-p * 7).toFixed(2);
      /* smooth horizontal arc — centred when the pane is centred */
      var tx = (dir * Math.sin(p * Math.PI / 2) * 7).toFixed(2);
      var tz = (-Math.abs(p) * 170).toFixed(0);
      var op = (1 - Math.abs(p) * 0.4).toFixed(3);

      el.style.transform =
        'translateX(' + tx + 'vw) translateZ(' + tz + 'px) ' +
        'rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
      el.style.opacity = op;
    }

    /* ── Staircase: always turning, wound faster by scroll ── */
    if (helix) {
      var spin = elapsed * 12; /* deg/sec ambient rotation */
      if (stairStage) {
        var sr = stairStage.getBoundingClientRect();
        /* how far the stage has travelled through the viewport, -1..1 */
        var sp = clamp((sr.top + sr.height / 2 - center) / (vh), -1, 1);
        spin += sp * 220; /* scrolling climbs/descends the spiral */
      }
      helix.style.transform = 'rotateX(-12deg) rotateY(' + spin.toFixed(2) + 'deg)';
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
