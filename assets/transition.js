/* ─────────────────────────────────────────────────────────────
   APX — in-place apply overlay (graceful glass, no page load)
   A Request Consideration click opens the application AS A FROSTED GLASS
   PANEL that materialises over a blurred home — no document navigation —
   and updates the URL to /apply via the History API. The apply content is
   prefetched so the open is instant. /apply stays a real, shareable URL
   (a direct visit loads the standalone page). Falls back to a normal
   navigation on reduced-motion or if the fetch fails.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Standalone /apply handles its own reveal — nothing to do here. */
  if (/^\/apply\/?$/.test(location.pathname)) return;

  var homeTitle = document.title;
  var stylesInjected = false;
  var cache = null;      /* prefetched apply HTML */
  var open = false;
  var busy = false;

  function prefetch() {
    if (cache || reduce) return;
    fetch('/apply/', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (t) { cache = t; })
      .catch(function () {});
  }
  if (!reduce) {
    if ('requestIdleCallback' in window) requestIdleCallback(prefetch);
    else setTimeout(prefetch, 1000);
  }

  function ensureStyles(doc) {
    if (stylesInjected) return;
    var st = doc.querySelector('style');
    if (st) {
      var s = document.createElement('style');
      s.id = 'apply-styles';
      s.textContent = st.textContent;
      document.head.appendChild(s);
    }
    stylesInjected = true;
  }

  function build(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    ensureStyles(doc);
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

  function present(html, push) {
    var ov = build(html);
    if (!ov) { location.href = '/apply'; return; }
    document.body.appendChild(ov);
    document.documentElement.classList.add('apply-open');
    ov.scrollTop = 0;
    if (push !== false) history.pushState({ apply: 1 }, '', '/apply');
    document.title = 'APX — Request Consideration';
    if (window.APXApplyInit) window.APXApplyInit();
    open = true;
    busy = false;
  }

  function openApply(push) {
    if (open || busy) return;
    if (reduce) { location.href = '/apply'; return; }
    busy = true;
    if (cache) { present(cache, push); return; }
    fetch('/apply/', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (t) { cache = t; present(t, push); })
      .catch(function () { location.href = '/apply'; });
  }

  function closeApply(push) {
    if (!open || busy) return;
    var ov = document.getElementById('applyOverlay');
    if (!ov) { open = false; return; }
    busy = true;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      document.documentElement.classList.remove('apply-open');
      document.title = homeTitle;
      open = false;
      busy = false;
      if (push !== false) history.pushState({}, '', '/');
    }
    ov.classList.add('apply-overlay--out');
    ov.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 480);
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;

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

  /* warm the cache the moment intent shows */
  document.addEventListener('pointerover', function (e) {
    if (e.target.closest && e.target.closest('a[href="/apply"]')) prefetch();
  }, { passive: true });

  window.addEventListener('popstate', function () {
    var onApply = /^\/apply\/?$/.test(location.pathname);
    if (onApply && !open) openApply(false);
    else if (!onApply && open) closeApply(false);
  });
})();
