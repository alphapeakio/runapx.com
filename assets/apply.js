/* ─────────────────────────────────────────────────────────────
   APX — application submit handler
   Serializes the form, POSTs JSON to /api/apply, and swaps in the
   success state without a reload. Native validation runs first; the
   honeypot + a start timestamp travel with the payload for the
   Function's bot filter.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var form = document.getElementById('applyForm');
  if (!form) return;

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

    /* Let the browser surface the first invalid required field. */
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
        /* Success — reveal the confirmation state. */
        if (wrap) wrap.style.display = 'none';
        if (done) done.classList.add('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        showError(err.message || 'Could not submit right now. Please try again.');
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();
