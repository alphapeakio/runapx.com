/* ─────────────────────────────────────────────────────────────
   APX — application handler  (Cloudflare Pages Function)
   Routed automatically to  POST /api/apply
   Validates, filters bots, and emails the application via Resend.

   Environment (set in the Cloudflare Pages dashboard):
     RESEND_API_KEY   secret — your Resend API key
     APPLY_TO         where applications are sent (default m@alphapeak.io)
     APPLY_FROM       verified sender (default "APX Applications <apply@runapx.com>")
   ───────────────────────────────────────────────────────────── */

const REQUIRED = [
  'athlete_name', 'grad_year', 'grade', 'gender', 'school', 'city', 'state',
  'athlete_email', 'guardian_name', 'guardian_relation', 'guardian_email',
  'guardian_phone', 'events', 'best_marks', 'results_link', 'why', 'goals',
  'college', 'commit', 'travel', 'format', 'coach_name', 'coach_contact', 'consent'
];

/* Human-readable labels + section grouping for the email body. */
const SECTIONS = [
  ['The Athlete', [
    ['athlete_name', 'Full name'], ['grad_year', 'Graduation year'],
    ['grade', 'Current grade'], ['gender', 'Competes as'],
    ['school', 'School'], ['city', 'City'], ['state', 'State / Region'],
    ['athlete_email', 'Athlete email'], ['athlete_phone', 'Athlete phone']
  ]],
  ['Parent / Guardian', [
    ['guardian_name', 'Name'], ['guardian_relation', 'Relationship'],
    ['guardian_email', 'Email'], ['guardian_phone', 'Phone']
  ]],
  ['Performance', [
    ['events', 'Primary event(s)'], ['best_marks', 'Best verified marks'],
    ['results_link', 'Results / profile'], ['weekly_volume', 'Weekly volume'],
    ['years_running', 'Years training'], ['other_sports', 'Other sports']
  ]],
  ['Commitment & Fit', [
    ['why', 'Why APX?'], ['goals', 'Goals'], ['college', 'Run in college?'],
    ['commit', 'Year-round commitment'], ['travel', 'Willing to travel'],
    ['format', 'Training preference'], ['constraints', 'Possible limits']
  ]],
  ['Verification & References', [
    ['coach_name', 'Coach'], ['coach_contact', 'Coach contact'],
    ['video_link', 'Race footage'], ['referral', 'Heard about APX via']
  ]]
];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  // ── Parse (JSON or urlencoded) ──
  let data = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      const form = await request.formData();
      form.forEach((v, k) => { data[k] = v; });
    }
  } catch (e) {
    return json({ ok: false, error: 'Could not read your submission.' }, 400);
  }

  // ── Bot filter: honeypot + submit timing ──
  if (data.company) return json({ ok: true }); // silently accept & drop
  const started = Number(data.started_at);
  if (started && Date.now() - started < 3000) {
    return json({ ok: false, error: 'That was a little quick — please try again.' }, 400);
  }

  // ── Validation ──
  const missing = REQUIRED.filter((k) => {
    const v = data[k];
    return v == null || String(v).trim() === '';
  });
  if (missing.length) {
    return json({ ok: false, error: 'Please complete every required field.' }, 400);
  }
  if (!isEmail(data.athlete_email) || !isEmail(data.guardian_email)) {
    return json({ ok: false, error: 'Please check the email addresses.' }, 400);
  }

  // ── Build the email ──
  const to = env.APPLY_TO || 'm@alphapeak.io';
  const from = env.APPLY_FROM || 'APX Applications <apply@runapx.com>';
  const subject = `APX Application — ${data.athlete_name} (${data.gender}, ${data.grad_year})`;

  let html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0a0e13">
    <h2 style="font-weight:400;letter-spacing:.02em">New APX Application</h2>`;
  let text = 'New APX Application\n==================\n';

  for (const [title, fields] of SECTIONS) {
    html += `<h3 style="margin:24px 0 8px;color:#0072d8;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${esc(title)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">`;
    text += `\n${title}\n${'-'.repeat(title.length)}\n`;
    for (const [key, label] of fields) {
      const raw = data[key];
      if (raw == null || String(raw).trim() === '') continue;
      const val = String(raw).trim();
      html += `<tr>
        <td style="padding:6px 12px 6px 0;vertical-align:top;color:#3d4650;white-space:nowrap">${esc(label)}</td>
        <td style="padding:6px 0;vertical-align:top;white-space:pre-wrap">${esc(val)}</td>
      </tr>`;
      text += `${label}: ${val}\n`;
    }
    html += `</table>`;
  }
  html += `<p style="margin-top:28px;font-size:12px;color:#8b96a3">Consent given · submitted via runapx.com/apply</p></div>`;
  text += `\nConsent: ${data.consent ? 'yes' : 'no'}\n`;

  // ── Send via Resend ──
  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'Applications are not accepting submissions right now.' }, 503);
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: String(data.athlete_email).trim(),
        subject,
        html,
        text
      })
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend error', res.status, detail);
      return json({ ok: false, error: 'We could not send your application. Please try again shortly.' }, 502);
    }
  } catch (e) {
    console.error('Resend exception', e);
    return json({ ok: false, error: 'We could not send your application. Please try again shortly.' }, 502);
  }

  return json({ ok: true });
}
