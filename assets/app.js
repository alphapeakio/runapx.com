/* ─────────────────────────────────────────────────────────────
   APX — home motion engine (vanilla, no framework, no deps)
   Enhancement only. With JS off, panes are flat and readable and a
   static aerial track is shown. This adds:
     · an aerial running track that pans down the straight and banks
       through the turns as you scroll — laps run underfoot
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

  /* ── Build the aerial running track ──
     Lanes are concentric stadium rects with a shiny platinum gradient
     stroke; app.js pans/banks the field along the running line each
     frame. Drawn now so it also shows (static) under reduced motion. */
  var trackField = document.getElementById('trackField');
  var trackRotor = document.getElementById('trackRotor');
  var RR = 450;                       /* running-line radius (50% wider) */
  var LL = 1260;                      /* straight length (50% longer)    */
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
    /* A polished metallic gradient so each lane catches the light. */
    var defs = document.createElementNS(SVGNS, 'defs');
    var grad = document.createElementNS(SVGNS, 'linearGradient');
    grad.setAttribute('id', 'laneShine');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
    [
      ['0%',   'rgba(150,160,174,0.48)'],
      ['40%',  'rgba(198,206,218,0.62)'],
      ['50%',  'rgba(230,235,242,0.70)'],
      ['60%',  'rgba(198,206,218,0.62)'],
      ['100%', 'rgba(140,151,166,0.48)']
    ].forEach(function (s) {
      var st = document.createElementNS(SVGNS, 'stop');
      st.setAttribute('offset', s[0]);
      st.setAttribute('stop-color', s[1]);
      grad.appendChild(st);
    });
    defs.appendChild(grad);
    trackField.appendChild(defs);

    /* Lane band centred on the running line (RR=450). Radii scaled 1.5×
       so the whole oval reads 50% wider; stroke stays 2px (thin lanes). */
    var lanes = [213.75, 281.25, 348.75, 416.25, 483.75, 551.25, 618.75, 686.25];
    for (var li = 0; li < lanes.length; li++) {
      trackField.appendChild(stadium(lanes[li], {
        fill: 'none', stroke: 'url(#laneShine)', 'stroke-width': 2
      }));
    }
    trackField.style.transform = 'translate(-450px, -630px)';        /* static pose */
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

    /* ── Aerial track ──
       At the hero it's zoomed in, banking at the foot of the screen.
       As you scroll past the hero it zooms out to reveal the COMPLETE
       oval, which then drifts slowly as the backdrop for the content. */
    if (trackField && trackRotor) {
      var heroP = clamp(window.scrollY / (vh * 0.85), 0, 1);
      var kk = LAP / (vh * 7);   /* one lap per 7 viewports — slower scroll progression */
      var pt = trackAt(window.scrollY * kk + elapsed * 14);
      var sc = 2.05 - heroP * 0.78;                   /* gentle zoom out past the hero: 2.05 → 1.27 */
      trackField.style.transform =
        'translate(' + (-pt.x).toFixed(1) + 'px,' + (-pt.y).toFixed(1) + 'px)';
      trackRotor.style.transform = 'rotate(' + pt.a.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      if (trackView) {
        /* open the mask from foot-of-hero to the full frame */
        trackView.style.setProperty('--tmy', (100 - heroP * 50).toFixed(1) + '%'); /* 100% → 50% */
        trackView.style.setProperty('--tmh', (62 + heroP * 88).toFixed(1) + '%');  /* 62% → 150% */
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

      /* Fill strength: full while the pane is pinned in the centre (the
         dwell, where the copy is being read), thinning back to frost once
         it is half a screen away and travelling. */
      var settle = 1 - clamp(Math.abs(p) / 0.5, 0, 1);

      el.style.transform =
        'translateX(' + tx + 'vw) translateZ(' + tz + 'px) ' +
        'rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
      el.style.opacity = op2;
      el.style.setProperty('--glass-a1', (0.26 + settle * 0.36).toFixed(3));
      el.style.setProperty('--glass-a2', (0.08 + settle * 0.34).toFixed(3));
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
