/* ─────────────────────────────────────────────────────────────
   APX — glass page transition + in-place apply overlay
   Clicking a Request Consideration link frosts a glass veil, opens the
   application IN PLACE (no document load) and updates the URL to /apply
   via the History API — so it feels seamless but /apply is still a real,
   shareable URL (a direct visit loads the standalone page). Falls back
   to a normal navigation on reduced-motion or if the fetch fails.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var veil = document.querySelector('.glass-veil');

  /* On the standalone /apply page this script does nothing (that page
     handles its own reveal). Only the home page runs the overlay. */
  if (/^\/apply\/?$/.test(location.pathname)) return;
  if (!veil) return;

  var COVER_MS = 620;   /* time for the glass to fully frost over        */
  var homeTitle = document.title;
  var stylesInjected = false;
  var busy = false;
  var open = false;

  function cover() {
    veil.classList.remove('glass-veil--clearing');
    /* restart the cover animation */
    veil.classList.remove('glass-veil--covering');
    void veil.offsetWidth;
    veil.classList.add('glass-veil--covering');
  }
  function clear() {
    veil.classList.remove('glass-veil--covering');
    veil.classList.remove('glass-veil--clearing');
    void veil.offsetWidth;
    veil.classList.add('glass-veil--clearing');
  }

  function buildOverlay(doc) {
    if (!stylesInjected) {
      var st = doc.querySelector('style');
      if (st) {
        var s = document.createElement('style');
        s.id = 'apply-styles';
        s.textContent = st.textContent;
        document.head.appendChild(s);
      }
      stylesInjected = true;
    }
    var wrap = doc.getElementById('formWrap');
    if (!wrap) return null;
    var done = doc.getElementById('done');
    var back = doc.querySelector('.backlink');

    var ov = document.createElement('div');
    ov.className = 'apply-overlay';
    ov.id = 'applyOverlay';
    if (back) { back.setAttribute('href', '/'); back.setAttribute('data-close', ''); ov.appendChild(back); }
    ov.appendChild(wrap);
    if (done) ov.appendChild(done);
    return ov;
  }

  function openApply(push) {
    if (open || busy) return;
    if (reduce) { location.href = '/apply'; return; }
    busy = true;
    var started = Date.now();
    cover();

    fetch('/apply/', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var ov = buildOverlay(doc);
        if (!ov) { location.href = '/apply'; return; }
        document.body.appendChild(ov);
        document.documentElement.classList.add('apply-open');
        ov.scrollTop = 0;
        if (push !== false) history.pushState({ apply: 1 }, '', '/apply');
        document.title = doc.title || 'APX — Request Consideration';
        if (window.APXApplyInit) window.APXApplyInit();
        open = true;

        /* reveal only once the glass has fully frosted, so the swap is hidden */
        var wait = Math.max(0, COVER_MS - (Date.now() - started));
        setTimeout(function () { clear(); busy = false; }, wait);
      })
      .catch(function () { location.href = '/apply'; });
  }

  function closeApply(push) {
    if (!open || busy) return;
    busy = true;
    cover();
    setTimeout(function () {
      var ov = document.getElementById('applyOverlay');
      if (ov) ov.remove();
      document.documentElement.classList.remove('apply-open');
      document.title = homeTitle;
      open = false;
      if (push !== false) history.pushState({}, '', '/');
      clear();
      busy = false;
    }, COVER_MS);
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;

    /* close controls inside the overlay (the ← APX link) */
    if (open) {
      var closeEl = e.target.closest('[data-close], #applyOverlay a[href="/"]');
      if (closeEl) { e.preventDefault(); history.back(); return; }
    }

    var a = e.target.closest('a[href="/apply"]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openApply(true);
  });

  window.addEventListener('popstate', function () {
    var onApply = /^\/apply\/?$/.test(location.pathname);
    if (onApply && !open) openApply(false);
    else if (!onApply && open) closeApply(false);
  });
})();
