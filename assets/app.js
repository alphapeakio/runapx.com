/* ─────────────────────────────────────────────────────────────
   APX — home interactivity (vanilla, no framework, no deps)
   Enhancement only: with JS off, everything is already visible and
   the CSS animations still run. This adds scroll reveals, a gentle
   parallax on the ambient light, a cursor-reactive light field, and
   the corner "Request Consideration" link fading in past the hero.
   All effects are disabled under prefers-reduced-motion.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll reveals ──────────────────────────────────────────
     Reveal elements as they enter the viewport. Under reduced
     motion (or without IntersectionObserver) just show them all. */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* Toggle a section's .in-view so its light field can bloom in. */
  var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));
  if (!reduce && 'IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('in-view', entry.isIntersecting);
      });
    }, { threshold: 0.35 });
    sections.forEach(function (s) { sio.observe(s); });
  }

  /* ── Corner CTA reveal ───────────────────────────────────────
     Fade the persistent "Request Consideration" link in once the
     visitor has moved past the hero. */
  var corner = document.querySelector('.corner-cta');
  var hero = document.querySelector('.hero');
  if (corner && hero) {
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          corner.classList.toggle('show', !entry.isIntersecting);
        });
      }, { threshold: 0 });
      cio.observe(hero);
    } else {
      corner.classList.add('show');
    }
  }

  if (reduce) return; /* everything below is pure motion polish */

  /* ── Cursor-reactive + scroll light ──────────────────────────
     Drive --mx/--my (used by the body bloom and the .lightfield)
     from the pointer on desktop, and drift the bloom slightly with
     scroll so the page feels three-dimensional. rAF-throttled. */
  var root = document.documentElement;
  var mx = 50, my = 40;          /* target, in % */
  var cmx = 50, cmy = 40;        /* current, eased */
  var scrollShift = 0;
  var ticking = false;

  function apply() {
    ticking = false;
    cmx += (mx - cmx) * 0.12;
    cmy += (my - cmy) * 0.12;
    root.style.setProperty('--mx', cmx.toFixed(2) + '%');
    root.style.setProperty('--my', (cmy + scrollShift).toFixed(2) + '%');
    if (Math.abs(mx - cmx) > 0.05 || Math.abs(my - cmy) > 0.05) request();
  }
  function request() {
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  }

  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (fine) {
    window.addEventListener('pointermove', function (e) {
      mx = (e.clientX / window.innerWidth) * 100;
      my = (e.clientY / window.innerHeight) * 100;
      request();
    }, { passive: true });
  }

  window.addEventListener('scroll', function () {
    /* small vertical drift, capped so the bloom never leaves the page */
    var max = document.body.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    scrollShift = (p - 0.5) * 6; /* ±3% */
    request();
  }, { passive: true });

  request();
})();
