/* ─────────────────────────────────────────────────────────────
   APX — glass page transition (outgoing)
   Intercepts clicks on links to /apply, frosts a glass veil over the
   page, then navigates. The apply page clears the veil on load (handled
   in CSS via the `entering` class). Falls back to a normal navigation
   under prefers-reduced-motion or if anything is off.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (/^\/apply\/?$/.test(location.pathname)) return; /* only on the way TO apply */

  var veil = document.querySelector('.glass-veil');
  if (!veil) return;

  var navigating = false;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="/apply"]');
    if (!a) return;
    /* let modified clicks (new tab, etc.) behave normally */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (navigating) return;

    e.preventDefault();
    navigating = true;
    veil.classList.add('glass-veil--covering');
    /* navigate once the glass has frosted over */
    setTimeout(function () { location.href = '/apply'; }, 500);
  });
})();
