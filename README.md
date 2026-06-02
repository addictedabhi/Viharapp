# Sadhumargi Vihar Directory

A free-hosted, public **Hindi (Devanagari)** directory of Jain sadhu/sadhvi vihar
(travel/stay) locations, with a searchable list and an interactive map. Data is
maintained by uploading an Excel file through a separate, password-protected
endpoint — no database, no paid services, $0 hosting.

## How it works

```
 Maintainer ──upload .xlsx──▶  Cloudflare Worker (worker/)              GitHub Pages (repo root)
 (types secret URL,            ├─ login + session (HMAC, rate-limited)   ├─ index.html  (table)
  logs in)                     ├─ parse Excel (SheetJS)                  └─ map.html    (map)
                               ├─ geocode places (OpenStreetMap)               ▲
                               └─ commit data.json/meta.json/source.xlsx ──────┘
                                  to this repo via the GitHub API        public reads data/data.json
```

- **Table page** (`index.html`) — every group as a row, live Hindi search, zone
  filter, click-to-call contacts, **Excel** and **PDF** download.
- **Map page** (`map.html`) — groups plotted on **OpenStreetMap** (Leaflet) with
  marker clustering; un-geocoded groups listed in a "नक्शे पर नहीं" panel.
- **Upload** (`worker/`) — a Cloudflare Worker with its own unlisted URL. The only
  write path: authenticates, parses the Excel, geocodes via Nominatim, and commits
  the published dataset back into this repo. GitHub Pages then re-serves it.

The public pages are static and contain no credentials; the real password and
GitHub token live only in Cloudflare. Each upload **replaces** the live dataset.

## Repository layout

```
index.html, map.html        Public pages (GitHub Pages, no build step)
assets/css, assets/js       Styles (Tesla-minimal) + ES modules (data/search/table/map/download)
assets/fonts, noto-vfs.js   Embedded Noto Sans Devanagari for Hindi PDF export
shared/records.js           Canonical record shape + Hindi search-text flattener
worker/                     Cloudflare Worker: auth, parse, geocode, GitHub commit
tools/seed/                 Seed records + build script that produces data/
data/                       Published dataset: data.json, meta.json, source.xlsx
docs/                       DEPLOY runbook + design spec & implementation plan
```

## Develop

```bash
npm install                 # vitest, happy-dom, xlsx
npm test                    # full test suite (76 tests)
npx vitest run worker/test/parse.rows.test.js   # a single test file
npm run seed                # rebuild data/ from tools/seed/seed-records.json (live Nominatim)
```

`CLAUDE.md` documents the architecture in depth — the data contract, the
worker↔KV cache adapter, geocoding behavior, and the auth model. Read it before
changing the record shape or the Excel column order (they are duplicated across
the parser, the download, and the seed and must stay in sync).

## Data format

Upload a `.xlsx` matching `data/source.xlsx` — one row per group, columns:

`Zone, Serial, GroupType, Members, Thana, ViharRoute, Place, City, District, KM, ViharKarmi, ActivePersons, Lat, Lng`

Multi-value cells (`Members`, `ViharKarmi`, `ActivePersons`) are newline-separated;
contacts are `name` then `phone` on alternating lines. `Lat`/`Lng` are optional —
blank cells are geocoded from `City` + `District`; fill them in to fix any place
that fails to geocode, then re-upload.

## Deploy

Full runbook in `docs/DEPLOY.md`:
- **Public site** → GitHub Pages from `main`, folder `/` (root).
- **Upload Worker** → `cd worker && npx wrangler deploy` after creating two KV
  namespaces and setting the secrets (`UPLOAD_USER`, `UPLOAD_PASS`,
  `SESSION_SECRET`, `GITHUB_TOKEN`). The Worker URL is unlisted — type it manually.

## Design

- Spec: `docs/superpowers/specs/2026-06-02-sadhumargi-vihar-app-design.md`
- Plan: `docs/superpowers/plans/2026-06-02-sadhumargi-vihar-app.md`
- Visual system: `DESIGN-tesla.md` (Tesla-minimal) + Noto Sans Devanagari.

## Notes

- Contact phone numbers are public **by design** (community directory).
- Map uses OpenStreetMap only (no Google Maps — avoids licensing).
- `xlsx` 0.18.5 has known npm advisories; exposure is limited to the authenticated
  admin's uploads. See `docs/DEPLOY.md` for the CDN-install mitigation.
