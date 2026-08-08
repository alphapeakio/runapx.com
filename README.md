# runapx.com

The site for **APX Training Group** (pronounced *Apex*) — a private distance
training group. Two pages by design:

- `index.html` — an interactive, low-information scroll journey built to convey
  prestige, not logistics. No pricing, schedule, or standards.
- `apply/` — the **Request Consideration** application, which emails each
  submission to the owner via a Cloudflare Pages Function.

Zero framework, zero build step. Shared styling lives in `assets/site.css`;
per-page CSS is inlined. Interactivity is vanilla JS (`assets/app.js`,
`assets/apply.js`). The form backend is `functions/api/apply.js`.

## Local preview

Static pages (visual work) — Functions do **not** run here:

```bash
npx serve . -l 3210
```

Full stack incl. the `/api/apply` Function:

```bash
npx wrangler pages dev .
```

To test a real submission locally, set the Resend key for the dev session:

```bash
RESEND_API_KEY=your_key APPLY_TO=you@example.com npx wrangler pages dev .
```

## Application backend (Resend)

The form POSTs to `/api/apply`, which validates, filters bots (honeypot +
submit-timing), formats the application, and emails it via
[Resend](https://resend.com).

### One-time setup

1. Create a Resend account and **verify the `runapx.com` domain** (add the DNS
   records Resend gives you — DNS is already on Cloudflare, so this is quick).
2. Create a Resend **API key**.
3. In the Cloudflare dashboard → Workers & Pages → **runapx** → Settings →
   Environment variables, add (Production **and** Preview):
   - `RESEND_API_KEY` — the key (mark as a **secret**)
   - `APPLY_TO` — where applications go, e.g. `m@alphapeak.io`
   - `APPLY_FROM` *(optional)* — sender, defaults to
     `APX Applications <apply@runapx.com>` (the address must be on the verified domain)

Without `RESEND_API_KEY` the endpoint returns a 503 and the form shows a polite
error, so nothing breaks before setup is complete.

## Deploy to Cloudflare Pages

### One-time setup

1. Log in to Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Deploy:
   ```bash
   npx wrangler pages deploy . --project-name=runapx
   ```
3. Add the custom domain in the dashboard:
   - Workers & Pages → **runapx** → Custom domains → Add **runapx.com**

### Git-based deploys (optional)

Connect this repo in the Cloudflare dashboard for automatic deploys on push:
- Build command: *(none)*
- Build output directory: `/`

Pages Functions in `functions/` ship automatically with the static deploy — no
build configuration needed.
