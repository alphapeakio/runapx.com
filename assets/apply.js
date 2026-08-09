/* ─────────────────────────────────────────────────────────────
   APX — application submit handler
   Exposed as window.APXApplyInit(scope) so it can bind the form on the
   standalone /apply page OR on the in-place overlay injected on the home
   page. Serializes the form, POSTs JSON to /api/apply, and swaps in the
   success state without a reload.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function init() {
    var form = document.getElementById('applyForm');
    if (!form || form.__apxBound) return;
    form.__apxBound = true;

    /* Stamp when the form became interactive — the Function rejects
       submissions that arrive implausibly fast. */
    var started = document.getElementById('started_at');
    if (started) started.value = String(Date.now());

    var btn = document.getElementById('submitBtn');
    var errEl = document.getElementById('formError');
    var wrap = document.getElementById('formWrap');
    var done = document.getElementById('done');

    function showError(msg) {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.classList.add('show');
    }
    function clearError() {
      if (!errEl) return;
      errEl.classList.remove('show');
      errEl.textContent = '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Submitting…';

      fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (r) {
          if (!r.ok || !r.body.ok) {
            throw new Error((r.body && r.body.error) || 'Something went wrong. Please try again.');
          }
          if (wrap) wrap.style.display = 'none';
          if (done) done.classList.add('show');
          var scroller = form.closest('.apply-overlay') || window;
          if (scroller.scrollTo) scroller.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch(function (err) {
          showError(err.message || 'Could not submit right now. Please try again.');
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  window.APXApplyInit = init;
  init(); /* standalone /apply page (no-op elsewhere until called) */
})();
