/* ─────────────────────────────────────────────────────────────
   APEX — home motion engine (vanilla, no framework, no deps)

   Scene-director architecture. The page is a scroll journey that
   climbs; each section owns a backdrop "scene" that the director
   swaps as you descend. A single requestAnimationFrame loop drives
   only the scene(s) currently on screen — off-screen scenes do zero
   per-frame work. Scenes cross-fade via CSS opacity.

   Scene contract (all methods optional except update):
     build(ctx)      create/adopt DOM once, set a STATIC pose
                     (runs even under reduced motion)
     activate()      add .is-active (CSS fades opacity → 1), mark live
     update(p, ctx)  per-frame transforms; called ONLY while live.
                     p = the scene's local scroll progress, 0..1
     deactivate()    remove .is-active (CSS fades opacity → 0)
     idle()          drop compositor hints once fully faded out

   Enhancement only. With JS off, panes are flat and readable. Under
   prefers-reduced-motion the director still builds + shows each
   scene's static pose, but the rAF loop never starts. The loop also
   pauses while the tab is hidden.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.documentElement;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── Corner CTA reveal ── (independent of the motion loop) */
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

  /* ─────────────────────────────────────────────────────────────
     Aerial running track geometry (Scene 01)
     Lanes are concentric stadium rects with a shiny platinum stroke.
     Drawn once, unconditionally, so the track also shows (static)
     under reduced motion / when the rAF loop is off.
     ───────────────────────────────────────────────────────────── */
  var trackField = document.getElementById('trackField');
  var trackRotor = document.getElementById('trackRotor');
  var RR = 300;                       /* running-line radius   */
  var LL = 840;                       /* straight length       */
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

    var lanes = [142.5, 187.5, 232.5, 277.5, 322.5, 367.5, 412.5, 457.5];
    for (var li = 0; li < lanes.length; li++) {
      trackField.appendChild(stadium(lanes[li], {
        fill: 'none', stroke: 'url(#laneShine)', 'stroke-width': 2
      }));
    }
    trackField.style.transform = 'translate(-300px, -420px)';        /* static pose */
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

  /* ─────────────────────────────────────────────────────────────
     SCENE 01 — the aerial track (wraps the geometry above)
     update() is the original track drive, verbatim: pans/banks the
     field along the running line and opens the vignette mask past
     the hero. Behaviour is byte-identical to the pre-director engine.
     ───────────────────────────────────────────────────────────── */
  function makeTrackScene() {
    return {
      id: '01',
      built: false,
      root: null,
      section: null,          /* uses global scrollY, not a section rect */
      build: function () {
        if (this.built) return;
        this.root = document.querySelector('.track-view');
        this.built = true;
      },
      activate: function () {
        if (!this.root) return;
        this.root.classList.add('is-active');
        if (trackRotor) trackRotor.style.willChange = 'transform';
        if (trackField) trackField.style.willChange = 'transform';
      },
      deactivate: function () {
        if (this.root) this.root.classList.remove('is-active');
      },
      idle: function () {
        if (trackRotor) trackRotor.style.willChange = 'auto';
        if (trackField) trackField.style.willChange = 'auto';
      },
      update: function (p, ctx) {
        if (!trackField || !trackRotor) return;
        var heroP = clamp(ctx.scrollY / (ctx.vh * 0.85), 0, 1);
        var kk = LAP / (ctx.vh * 5);
        var pt = trackAt(ctx.scrollY * kk + ctx.elapsed * 14);
        var sc = 2.05 - heroP * 0.78;                   /* zoom out past the hero */
        trackField.style.transform =
          'translate(' + (-pt.x).toFixed(1) + 'px,' + (-pt.y).toFixed(1) + 'px)';
        trackRotor.style.transform = 'rotate(' + pt.a.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
        if (this.root) {
          this.root.style.setProperty('--tmy', (100 - heroP * 50).toFixed(1) + '%'); /* 100% → 50% */
          this.root.style.setProperty('--tmh', (62 + heroP * 88).toFixed(1) + '%');  /* 62% → 150% */
        }
      }
    };
  }

  /* ─────────────────────────────────────────────────────────────
     SCENE 05 — the glass helix staircase (the summit / ascent payoff)
     A column of frosted-glass blades spiralling up a central axis.
     As you scroll into the final section the column rotates and a
     virtual camera climbs it toward a light at the top. Built from
     transforms only (no backdrop-filter on the blades — see notes in
     index.html) so it composites cheaply and degrades to a static,
     illuminated staircase under reduced motion.
     ───────────────────────────────────────────────────────────── */
  function makeHelixScene() {
    var N = 24;            /* blades                              */
    var THETA = 30;        /* degrees between blades (N·θ = 720°) */
    var R = 360;           /* helix radius (px)                   */
    var H = 52;            /* rise per blade (px)                 */
    var TILT = 10;         /* constant look-up tilt (deg)         */
    var SPIN0 = -110;      /* start angle: rotated on entry (deg) */
    var SPIN_TOTAL = 110;  /* sweep so the climb resolves face-on
                              and symmetric at the summit (p→1)   */
    var stage = null, axis = null, light = null, steps = [];

    return {
      id: '05',
      built: false,
      root: null,
      section: null,
      build: function () {
        if (this.built) return;
        stage = document.createElement('div');
        stage.id = 'helixStage';
        stage.setAttribute('aria-hidden', 'true');
        light = document.createElement('div');
        light.id = 'helixLight';
        axis = document.createElement('div');
        axis.id = 'helixAxis';
        for (var i = 0; i < N; i++) {
          var st = document.createElement('div');
          st.className = 'helix-step';
          /* base pose: angular position, push out to radius, raise up the axis */
          st.style.transform =
            'rotateY(' + (i * THETA) + 'deg) translateZ(' + R + 'px) translateY(' + (-i * H) + 'px)';
          /* static front-lit shimmer at the rest pose (rotateY 0), so the
             reduced-motion staircase reads dimensional, not flat. The rAF
             loop overwrites these per frame when motion is allowed. */
          st.style.opacity = (0.45 + 0.55 * Math.max(0, Math.cos(i * THETA * Math.PI / 180))).toFixed(3);
          axis.appendChild(st);
          steps.push(st);
        }
        stage.appendChild(light);
        stage.appendChild(axis);
        document.body.appendChild(stage);
        /* static mid pose (p≈0.5) — what reduced-motion users see; the
           rAF loop overwrites it every frame when motion is allowed. */
        axis.style.transform =
          'translateY(' + ((N - 1) * H * 0.5).toFixed(1) + 'px) rotateX(' + TILT + 'deg) rotateY(0deg)';
        light.style.opacity = '0.62';
        this.root = stage;
        this.built = true;
      },
      activate: function () {
        if (!stage) return;
        stage.classList.add('is-active');
        axis.style.willChange = 'transform';
        light.style.willChange = 'opacity, transform';
      },
      deactivate: function () {
        if (stage) stage.classList.remove('is-active');
      },
      idle: function () {
        if (!axis) return;
        axis.style.willChange = 'auto';
        light.style.willChange = 'auto';
      },
      update: function (p) {
        if (!axis) return;
        var spin = SPIN0 + p * SPIN_TOTAL;
        /* camera climbs, but stays within the dense middle band of the
           column so the frame never runs out of blades at either end —
           the ascent reads as blades streaming down past you + the
           brightening summit light, not an empty top. */
        var lift = (N - 1) * H * (0.22 + 0.56 * p);
        axis.style.transform =
          'translateY(' + lift.toFixed(1) + 'px) rotateX(' + TILT + 'deg) rotateY(' + spin.toFixed(2) + 'deg)';
        light.style.opacity = (0.30 + 0.70 * p).toFixed(3);
        light.style.transform = 'translateX(-50%) scale(' + (0.8 + 0.5 * p).toFixed(3) + ')';
        /* front-facing blades glow, back ones dim → a rotating shimmer */
        for (var i = 0; i < steps.length; i++) {
          var faceRad = (spin + i * THETA) * Math.PI / 180;
          steps[i].style.opacity = (0.45 + 0.55 * Math.max(0, Math.cos(faceRad))).toFixed(3);
        }
      }
    };
  }

  /* ─────────────────────────────────────────────────────────────
     Scene director — maps sections to scenes, activates on scroll
     via IntersectionObserver, and keeps a `live` set the rAF loop
     drives. Runs (build/activate) even under reduced motion so each
     scene's static pose is shown; only the loop below is gated.
     ───────────────────────────────────────────────────────────── */
  var SCENES = { '01': makeTrackScene(), '05': makeHelixScene() };
  var FADE_MS = 700;                  /* must match the CSS opacity transition */
  var live = [];                      /* scenes currently rendering */
  var dropTimers = {};                /* scene id → fade-out drop timer */

  /* Wire each registered scene to its section + a set of the elements
     currently intersecting for it (a scene can be fed by several — the
     hero AND section 01 both drive scene 01). */
  Object.keys(SCENES).forEach(function (id) {
    SCENES[id].section = document.querySelector('.section[data-scene="' + id + '"]');
    SCENES[id].els = new Set();
  });
  /* Scene 01 drives itself from global scrollY, so it needs no per-frame
     section-progress reading — null the section to skip that work. */
  SCENES['01'].section = null;

  function sceneForEl(el) {
    if (el === hero) return SCENES['01'];
    var id = el.getAttribute && el.getAttribute('data-scene');
    return id ? SCENES[id] : null;
  }

  function addLive(scene) {
    if (live.indexOf(scene) === -1) live.push(scene);
  }
  function activateScene(scene) {
    if (dropTimers[scene.id]) { clearTimeout(dropTimers[scene.id]); delete dropTimers[scene.id]; }
    scene.build && scene.build();
    scene.activate && scene.activate();
    addLive(scene);
  }
  function deactivateScene(scene) {
    scene.deactivate && scene.deactivate();
    /* keep rendering through the cross-fade, then go fully idle */
    dropTimers[scene.id] = setTimeout(function () {
      var i = live.indexOf(scene);
      if (i !== -1) live.splice(i, 1);
      delete dropTimers[scene.id];
      scene.idle && scene.idle();
    }, FADE_MS + 60);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var scene = sceneForEl(e.target);
        if (!scene) return;
        /* Track the actual set of intersecting elements — robust to an
           element's first callback being `false` (off-screen at load).
           Activate when the set becomes non-empty, deactivate when it
           empties. Never deactivates a scene that was never intersecting. */
        if (e.isIntersecting) {
          if (!scene.els.has(e.target)) {
            scene.els.add(e.target);
            if (scene.els.size === 1) activateScene(scene);
          }
        } else if (scene.els.has(e.target)) {
          scene.els.delete(e.target);
          if (scene.els.size === 0) deactivateScene(scene);
        }
      });
    }, { rootMargin: '25% 0px 25% 0px', threshold: 0 });

    if (hero) io.observe(hero);
    Array.prototype.forEach.call(document.querySelectorAll('.section[data-scene]'), function (sec) {
      io.observe(sec);
    });
  } else {
    /* No IO: show every registered scene statically. */
    Object.keys(SCENES).forEach(function (id) { activateScene(SCENES[id]); });
  }

  /* Local scroll progress of a section: 0 as its top reaches the top
     of the viewport, 1 as its bottom reaches the bottom. */
  function localProgress(section, vh) {
    var r = section.getBoundingClientRect();
    var span = r.height - vh;
    return clamp(span > 0 ? -r.top / span : 0, 0, 1);
  }

  if (reduce) return; /* everything below is pure motion */

  /* ── Content panes: turn + weave + recede as they cross the view ── */
  var panes = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));

  /* ── Cursor / scroll driven body light (frosted glass refracts it) ── */
  var mx = 50, my = 40, cmx = 50, cmy = 40;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (fine) {
    window.addEventListener('pointermove', function (e) {
      mx = (e.clientX / window.innerWidth) * 100;
      my = (e.clientY / window.innerHeight) * 100;
    }, { passive: true });
  }

  var vh = window.innerHeight;
  window.addEventListener('resize', function () { vh = window.innerHeight; }, { passive: true });

  var ctx = { scrollY: 0, vh: vh, elapsed: 0 };
  var t0 = null;
  var elapsedBase = 0;    /* accumulated seconds carried across pauses */
  var rafId = null;
  var paused = false;

  /* Pause the loop while the tab is hidden; resume without a time jump —
     elapsed continues from where it left off (no forward skip, no phase
     snap in the track's idle drift). */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      paused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (paused) {
      paused = false;
      elapsedBase = ctx.elapsed;
      t0 = null;
      rafId = requestAnimationFrame(frame);
    }
  });

  function frame(ts) {
    if (paused) return;
    if (t0 === null) t0 = ts;
    ctx.elapsed = elapsedBase + (ts - t0) / 1000; /* seconds */

    /* eased cursor light for the body bloom */
    cmx += (mx - cmx) * 0.08;
    cmy += (my - cmy) * 0.08;
    root.style.setProperty('--mx', cmx.toFixed(2) + '%');
    root.style.setProperty('--my', cmy.toFixed(2) + '%');

    ctx.scrollY = window.scrollY;
    ctx.vh = vh;

    /* drive only the scene(s) currently on screen */
    for (var s = 0; s < live.length; s++) {
      var scene = live[s];
      var p = scene.section ? localProgress(scene.section, vh) : 0;
      scene.update(p, ctx);
    }

    /* ── Frosted content panes ── */
    var center = vh / 2;
    for (var i = 0; i < panes.length; i++) {
      var el = panes[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;

      var mid = r.top + r.height / 2;
      var pp = clamp((mid - center) / center, -1, 1); /* +1 below, -1 above */
      var dir = parseFloat(el.getAttribute('data-dir')) || 1;

      var rotY = (dir * pp * 26).toFixed(2);
      var rotX = (-pp * 7).toFixed(2);
      var tx = (dir * Math.sin(pp * Math.PI / 2) * 7).toFixed(2); /* centred at centre */
      var tz = (-Math.abs(pp) * 170).toFixed(0);
      var op2 = (1 - Math.abs(pp) * 0.4).toFixed(3);

      el.style.transform =
        'translateX(' + tx + 'vw) translateZ(' + tz + 'px) ' +
        'rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
      el.style.opacity = op2;
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
})();
