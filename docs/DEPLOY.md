# Deploy Runbook

## A. GitHub Pages (public site)
1. Push this repo to GitHub (`OWNER/REPO`).
2. Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, folder `/ (root)`.
3. Visit `https://OWNER.github.io/REPO/` — table page loads from `data/data.json`.

## B. Cloudflare Worker (secured upload)
1. `cd worker; npm install`
2. Create KV namespaces:
   ```
   npx wrangler kv namespace create GEOCODE_CACHE
   npx wrangler kv namespace create RATE_LIMIT
   ```
   Paste the returned IDs into `worker/wrangler.toml` (uncomment the blocks).
3. Set `GITHUB_REPO` in `[vars]` to `OWNER/REPO`; confirm `GITHUB_BRANCH`.
4. Create a **fine-grained GitHub token**: repo = this repo only, Permissions →
   Contents: Read and write. Copy the token.
5. Set secrets (you will be prompted to paste each value):
   ```
   npx wrangler secret put UPLOAD_USER
   npx wrangler secret put UPLOAD_PASS
   npx wrangler secret put SESSION_SECRET   # long random string
   npx wrangler secret put GITHUB_TOKEN
   ```
   Suggested complex credentials (example — generate your own):
   - UPLOAD_USER: `vihar_admin_7Kq`
   - UPLOAD_PASS: a 20+ char random mix (store in a password manager)
   - SESSION_SECRET: `openssl rand -base64 48`
6. `npx wrangler deploy` → note the Worker URL
   (`https://sadhumargi-upload.<account>.workers.dev`).
7. **Do NOT link this URL** anywhere on the public site. Type it manually to log in.

## C. Update flow
1. Open the Worker URL → log in.
2. Upload the canonical `.xlsx` (same shape as `data/source.xlsx`).
3. Worker parses → geocodes → commits to the repo. GitHub Pages redeploys (~1 min).
4. Public pages show the new data. Fix any "नक्शे पर नहीं" rows by adding
   `Lat`/`Lng` columns in the Excel and re-uploading.

## D. Security notes
- Real credentials + GitHub token live only in Cloudflare secrets — never in the
  repo or any downloadable file.
- Login is rate-limited (5 / 15 min per IP); sessions are signed, HttpOnly, 2h.
- The public repo contains only published data (incl. public phone numbers — by
  design for this community directory).
- `xlsx` (SheetJS) 0.18.5 from npm has known dependency advisories (ReDoS/prototype
  pollution). Exposure is limited: only the authenticated admin uploads files to the
  parser. To eliminate, install SheetJS from their official CDN/tarball per their docs.

## E. Troubleshooting
- **"प्रकाशन विफल" (publish failed) on upload** = the GitHub commit step failed, not
  parse/geocode. See the real error with `npx wrangler tail --format pretty`, then retry.
- **`403 Resource not accessible by personal access token`** = `GITHUB_TOKEN` lacks
  **Contents: Read and write** (or the fine-grained token is not granted to this repo).
  Fix: regenerate the fine-grained token — Resource owner = repo owner, Repository
  access = *Only select repositories* → this repo, Permissions → **Contents: Read and
  write**. Then `npx wrangler secret put GITHUB_TOKEN`. No redeploy — the secret is
  picked up live. Retry the upload.
- `401` on commit = token expired/invalid (not a permission problem). A `404` on the
  PUT can mask a 403 when a fine-grained token is not authorized for the repo.
- Each successful upload makes **3 commits** (one PUT per file: `data.json`,
  `meta.json`, `source.xlsx`) — cosmetic, by design.
