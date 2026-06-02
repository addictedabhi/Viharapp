# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A free-hosted Hindi (Devanagari) directory of Jain sadhu/sadhvi vihar (travel/stay) locations. Two deploy targets:

- **Public site** — static files at the repo root, served by **GitHub Pages**. No build step.
- **Secured upload** — a **Cloudflare Worker** in `worker/`, deployed separately with its own unlisted URL. It is the only write path: it authenticates, parses an uploaded Excel, geocodes, and commits the dataset back into this repo via the GitHub API. GitHub Pages then re-serves it.

Design/spec/plan live in `docs/superpowers/`. Deploy runbook: `docs/DEPLOY.md`. Visual system: `DESIGN-tesla.md` (Tesla-minimal: white, single accent `#3E6AE1`, flat, 4px radius) paired with Noto Sans Devanagari for Hindi.

## Commands

All from the repo root unless noted. Vitest config lives at the root and covers root, `shared/`, `assets/`, and `worker/` tests (`worker/` has no local vitest — it uses the root one).

```bash
npm install                      # root deps (vitest, happy-dom, xlsx)
npm test                         # full suite (run mode)
npm run test:watch               # watch mode
npx vitest run worker/test/parse.rows.test.js        # one test file
npx vitest run worker/ -t "rejects an expired token"  # one test by name
npm run seed                     # rebuild data/ from tools/seed/seed-records.json (geocodes via live Nominatim, ~1s/place)

cd worker && npm install         # worker deps (wrangler, xlsx)
cd worker && npx wrangler dev    # run the Worker locally
cd worker && npx wrangler deploy # deploy the Worker
```

Test environment is `node` by default; files matching `assets/**` or `*.dom.test.js` run under `happy-dom` (see `vitest.config.js`). Frontend logic modules are unit-tested; pure-DOM glue in `index.html`/`map.html` is not.

## Architecture: the data contract is the spine

Everything hinges on one canonical record shape and one Excel column order. Changing either means touching several files in lockstep — this is the main thing to get right.

- **Canonical record shape** is defined once by `emptyRecord()` in `shared/records.js`. `recordToSearchText()` there flattens a record to an NFC-normalized string used by the Hindi search on both pages. Devanagari is multi-byte: always NFC-normalize before comparing/searching.
- **The 14-column Excel HEADER** (`Zone, Serial, GroupType, Members, Thana, ViharRoute, Place, City, District, KM, ViharKarmi, ActivePersons, Lat, Lng`) is duplicated in `worker/src/parse.js`, `assets/js/download.js`, and `tools/seed/build-seed.mjs`. They MUST stay identical, in order. `parse.js` validates the header by exact position.
- **Multi-value cells** (members, contacts) are newline-joined inside one cell. Contacts serialize as `name\nphone\nname\nphone`; the parser (`parseContacts`) re-pairs a phone-looking line to the preceding name. The Excel download round-trips back into the parser — keep that property when editing either side.
- **Published artifacts:** the Worker / seed write `data/data.json` (`{version, records}`, records sorted by `zoneOrder` then `serial`), `data/meta.json` (`totals` + `geocodeFailures`), and `data/source.xlsx` (the canonical Excel, what the Excel-download button serves). The frontend reads `dataJson.records` and `meta.totals`.

Data flow: **upload .xlsx → `parseWorkbook` → `geocodeGroups` (mutates records, adds lat/lng/geocodeStatus) → `buildOutputs` → `commitFiles` (GitHub API) → GitHub Pages → frontend fetches `data/data.json`.** Replace-current model: each upload overwrites the dataset.

## Worker internals (`worker/src/`)

- `index.js` exports `handle(request, env, deps)` — the testable router; `deps` injects `now/parseWorkbook/geocodeGroups/commitFiles` so tests run without network. The default export is the Cloudflare `{ fetch }`. Routes: `GET /` login, `POST /login` (rate-limited, then **`await checkCredentials`** — it is async), `/upload` (session-gated), `/logout`.
- **KV cache gotcha:** `geocode.js` expects an *object* cache (`get` returns an object, `set` stores one). Real Cloudflare KV is different (`get` returns a *string*, write is `put`). `index.js` bridges this with `kvCache(env.GEOCODE_CACHE)` — **never pass a raw KV namespace to `geocodeGroups`**. The seed path uses `tools/seed/file-cache.mjs`, which already implements the object interface. The rate limiter (`auth.js` `rateLimitHit`) talks to KV directly (`get`/`put`, string values) — that is correct and intentional.
- **Geocoding:** `geocode.js` `placeKey` keys the cache on the *full original* district; `queriesFor` strips the trailing Hindi state segment (e.g. `", राज."`) and adds a `city, India` fallback, because Nominatim fails on the abbreviations. `lookup` swallows network errors as a miss so a Nominatim outage degrades to all-`failed` rather than crashing the upload (spec §11). Respect Nominatim's ≤1 req/sec — the throttle sleeps after every lookup (do not "optimize" it to skip across records).
- **Auth (`auth.js`):** stateless HMAC-signed session tokens (`payload.sig`, Web Crypto), signature verified *before* parsing the payload; `checkCredentials` compares fixed-length HMAC digests (async) so credential length doesn't leak.
- Secrets (`UPLOAD_USER`, `UPLOAD_PASS`, `SESSION_SECRET`, `GITHUB_TOKEN`) live only in Cloudflare via `wrangler secret put` — never in files. `wrangler.toml` `[vars]` (repo, branch, Nominatim UA) and KV IDs are the only committed config.

## Frontend (`assets/js/`, root HTML)

Plain ES modules, no bundler. CDN globals for `window.XLSX` (SheetJS), `window.pdfMake`, `window.L` (Leaflet + markercluster). `assets/js/noto-vfs.js` is a generated base64-embedded Noto Devanagari font registered as the pdfMake font `NotoDeva` (regenerate via `node tools/build-noto-vfs.mjs`) — Tesla's font cannot render Devanagari, so PDFs need this.

All dynamic values rendered into HTML go through an `esc()` helper (in `table.js` and `map.js`, escapes `& < > "`) — keep every new sink escaped; the data is third-party (uploaded). The map uses OpenStreetMap tiles only (no Google — licensing). `map.js` pure helpers (`mappable`/`failedList`/`popupHtml`/`esc`) are tested; `buildMap`/`filterMarkers` need `window.L` and run only in-browser.

## Conventions specific to this repo

- Phone numbers are shown publicly **by design** (community directory) — not an oversight.
- Zone 11 legitimately does not exist in the source data; zones are `01–10` and `12`.
- The seed in `tools/seed/seed-records.json` is a representative multi-zone subset, not the full 546-member roster; the full dataset is published via the Excel upload flow.
- `xlsx` 0.18.5 carries known npm advisories; exposure is limited to the authenticated admin's uploads. See `docs/DEPLOY.md` for the CDN-install mitigation.
