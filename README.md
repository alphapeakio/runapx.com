# runapx.com

Minimal landing page for **APX Running Group** (pronounced Apex).

## Local preview

Open `index.html` in a browser, or serve locally:

```bash
npx serve .
```

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

3. Add custom domain in the Cloudflare dashboard:
   - Workers & Pages → **runapx** → Custom domains → Add **runapx.com**

### Git-based deploys (optional)

Connect this repo in the Cloudflare dashboard for automatic deploys on push:
- Build command: *(none)*
- Build output directory: `/`
