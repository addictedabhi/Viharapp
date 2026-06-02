# Sadhumargi Vihar Directory App — Design Spec

**Date:** 2026-06-02
**Status:** Approved (pending written-spec review)

## 1. Summary

A public, free-to-host web app that displays the Sadhumargi vihar (travel/stay)
directory — groups of Jain sadhus/sadhvis, their current locations, and local
contact people — in two ways:

1. **Table page** — a searchable HTML view of the data, with Excel and PDF download.
2. **Map page** — the groups plotted on an OpenStreetMap map (no Google Maps).

Data is maintained by uploading an Excel file through a **separately-hosted,
password-protected upload endpoint** (a Cloudflare Worker). The public pages are
hosted on **GitHub Pages**.

The interface is in **Hindi**; the data is in Hindi (Devanagari).

## 2. Goals / Non-goals

**Goals**
- Public, zero-cost hosting (GitHub Pages + Cloudflare Worker free tier + OSM).
- Genuine server-side protection of the upload action (not client-side/obscurity).
- Reliable parsing of the maintained data.
- Map without any licensed/paid mapping provider.

**Non-goals**
- No automatic PDF→Excel conversion at upload time (see §10 — infeasible reliably
  for the source PDF). PDF is a *download output* only.
- No user accounts/roles beyond a single upload login.
- No accumulate/merge data model — each upload replaces the live dataset.

## 3. Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Auth intent | Real protection (server-side), not a client-side gate |
| Backend | Cloudflare Worker (separate URL = the manually-typed "secret" upload endpoint) |
| Coordinates | Excel has place names only → Worker geocodes via OSM Nominatim at upload |
| Update model | Replace-current (latest upload is the live dataset) |
| Upload/maintenance format | **Excel** (`.xlsx`); this PDF converted once to seed it |
| Downloads | Both **Excel** and **PDF**, generated from the data |
| Phone numbers | Shown publicly (intentional community directory) |
| UI language | Hindi only; search box + placeholder in Hindi |
| Hosting | Public pages on GitHub Pages; upload on Cloudflare Worker |
| Visual design | Tesla-inspired system (`DESIGN-tesla.md`) + Noto Sans Devanagari for Hindi |
| Source control | User commits manually (no auto-commit by the workflow) |

## 4. Architecture

```
                         ┌────────────────────────────┐
   Public internet  ───▶ │  GitHub Pages (static)     │
                         │  index.html  (Table)       │
                         │  map.html    (Map)         │
                         │  reads /data/data.json     │
                         └─────────────▲──────────────┘
                                       │ commit data.json / meta.json / source.xlsx
                                       │ (GitHub API)
   Maintainer (types secret URL) ─────▶┌────────────────────────────┐
                                       │  Cloudflare Worker         │
                                       │  - login (server secrets)  │
                                       │  - parse .xlsx (SheetJS)   │
                                       │  - geocode (Nominatim+KV)  │
                                       │  - commit to GitHub repo   │
                                       └────────────────────────────┘
```

The public pages **never** call the Worker. The Worker holds all secrets
(credentials + GitHub token) in Cloudflare server env — nothing sensitive ships
in any downloadable file.

## 5. Data model

One canonical record per group:

```jsonc
{
  "zone":          "02-बीकानेर-मारवाड़-अंचल",  // अंचल banner
  "zoneOrder":     2,
  "serial":        1,                           // क्र.स. within zone
  "groupType":     "साधु",                      // "साधु" | "साध्वी" (monk / nun)
  "members":       ["आचार्य श्री रामलाल जी म.सा.", "..."], // [0] = head
  "thana":         8,                           // ठाणा count
  "viharRoute":    "देशनोक से रासीसर",          // विहार कहाँ से कहाँ (nullable)
  "place":         "सुराना भवन",                 // स्थान
  "city":          "नोखागाँव",                   // गाँव/शहर
  "district":      "बीकानेर, राज.",              // जिला (+ state)
  "km":            17.5,                          // किमी (nullable)
  "viharKarmi":    [{ "name": "...", "phone": "..." }], // विहारकर्मी
  "activePersons": [{ "name": "...", "phone": "..." }], // सक्रिय व्यक्ति
  "lat":           27.56,
  "lng":           73.47,
  "geocodeStatus": "ok"                          // "ok" | "failed" | "manual"
}
```

### Published files (in repo)

```
/index.html              Table page (default)
/map.html                Map page
/assets/css/...          styles (Hindi UI)
/assets/js/...           app code + vendored libs or CDN refs
/data/data.json          published dataset (Worker overwrites)
/data/source.xlsx        last uploaded Excel (Excel download source)
/data/meta.json          { uploadedAt, fileName, totals, geocodeFailures[] }
/docs/...                this spec + plan
```

`meta.json.totals` holds computed counts (e.g. कुल साधु-साध्वी, कुल संत) shown in a
summary bar. Counts are derived at parse time, not trusted from the sheet.

## 6. Canonical Excel template

One row per group. Multi-value cells use newline separation inside a single cell.

| Column | Notes |
|---|---|
| `Zone` | अंचल banner string (e.g. `02-बीकानेर-मारवाड़-अंचल`) |
| `Serial` | क्र.स. within zone (integer) |
| `GroupType` | `साधु` or `साध्वी` |
| `Members` | newline-separated names; first line = head |
| `Thana` | integer count |
| `ViharRoute` | optional |
| `Place` | स्थान |
| `City` | गाँव/शहर |
| `District` | जिला + state |
| `KM` | number, optional |
| `ViharKarmi` | newline-separated `name + phone` |
| `ActivePersons` | newline-separated `name + phone` |
| `Lat` | optional; blank → geocoded |
| `Lng` | optional; blank → geocoded |

A one-time conversion of the source PDF (`30.05.2026 vihar suchna.pdf`) into this
template seeds the first dataset.

## 7. Public frontend (GitHub Pages, Hindi UI)

**Visual design system: Tesla-inspired** (see `DESIGN-tesla.md`).
- Adopt the Tesla language: Pure White (`#FFFFFF`) canvas, single Electric Blue
  (`#3E6AE1`) accent used only for the primary action, flat surfaces (no shadows,
  no gradients, no borders — separation via spacing), 4px button radius, 0.33s
  transitions, generous whitespace, text hierarchy in Carbon Dark (`#171A20`) /
  Graphite (`#393C41`) / Pewter (`#5C5E62`).
- **Font caveat:** Tesla's Universal Sans does NOT render Devanagari. Pair the
  Tesla aesthetic with **Noto Sans Devanagari** (weights 400/500 only, matching
  Tesla's two-weight restraint) for all Hindi content and UI. Latin/numerals may
  use the Tesla `-apple-system, Arial` stack.
- The map and table are dense data views, so the strict "one message per 100vh
  section" rule is relaxed — but the chrome (nav, buttons, search, summary bar)
  stays minimal, flat, white, and blue-accented per the Tesla system.
- The Worker login/upload pages reuse the same minimal white + Electric Blue look.

**Shared**
- Both pages `fetch('/data/data.json')` once; UTF-8 for Devanagari.
- Top summary bar: totals from `meta.json` + `अंतिम अपडेट: <date>`.
- Nav links between Table and Map. Mobile-responsive (Tesla breakpoints as a guide).
- Empty/missing data → friendly `कोई डेटा उपलब्ध नहीं` state (no crash).
- Tech: plain HTML/CSS/vanilla JS, no build step. Libs: Leaflet, Leaflet.markercluster,
  SheetJS (Excel), a PDF generator (e.g. pdfmake/jsPDF with an embedded Devanagari
  font so generated PDFs render Hindi correctly).

**Table page (`index.html`) — सूची**
- One row per group; columns mirror the PDF: अंचल, क्र.स., नाम (head bold), ठाणा,
  विहार मार्ग, स्थान, गाँव/शहर, जिला, किमी, विहारकर्मी, सक्रिय व्यक्ति.
- Phones rendered as `tel:` links (click-to-call).
- **Live Hindi search box** with placeholder `खोजें: नाम, शहर या जिला...` — filters
  rows instantly across all text fields, including Hindi.
- Zone filter dropdown (`अंचल चुनें`).
- Collapsible per-zone banner headers (like the PDF).
- **Downloads:** `Excel डाउनलोड` (serves stored `/data/source.xlsx`) and
  `PDF डाउनलोड` (generated client-side from data with an embedded Devanagari font).

**Map page (`map.html`) — नक्शा**
- Leaflet + OpenStreetMap raster tiles (free, no key, no Google). India-centered.
- One marker per group that geocoded successfully; **marker clustering** for ~150
  points; clusters expand on zoom.
- Marker popup: head name + member count, स्थान/गाँव/जिला, किमी, विहार मार्ग,
  contacts (`tel:` links).
- Markers color-coded by `groupType` (साधु vs साध्वी) with a legend.
- Same Hindi search box filters/highlights markers and pans to matches.
- `geocodeStatus:"failed"` groups listed in a `नक्शे पर नहीं` side panel (never
  silently dropped).

## 8. Cloudflare Worker (secured upload)

Own URL, e.g. `https://sadhumargi-upload.<account>.workers.dev`. **Not linked**
anywhere on the public site — typed manually. This is the "secret URL".

**Auth**
- `GET /` → minimal Hindi login page.
- Credentials in Worker secrets `UPLOAD_USER`, `UPLOAD_PASS` (set via
  `wrangler secret put`). Complex generated values; never in any shipped file.
- On success → signed session cookie (HMAC with `SESSION_SECRET`, ~2h expiry,
  `HttpOnly`, `Secure`, `SameSite=Strict`).
- Per-IP rate limiting on login (e.g. 5 attempts / 15 min) via KV.

**Upload (`POST /upload`, session required)**
1. Accept `.xlsx` only; size cap (e.g. 5 MB); reject other types.
2. Parse with SheetJS → normalize to canonical records (§5). Validate required
   columns; collect row-level errors.
3. Geocode each group (§9) → attach `lat`/`lng`/`geocodeStatus`.
4. Build `data.json` + `meta.json` (totals, `uploadedAt`, `fileName`,
   `geocodeFailures`).
5. Commit `data/data.json`, `data/meta.json`, `data/source.xlsx` to the repo via
   GitHub API (`PUT /contents`) using `GITHUB_TOKEN` (fine-grained, scoped to this
   repo only, `contents:write`).
6. Return a Hindi result page: rows parsed, totals, geocode failures, parse warnings.

**Worker secrets (never public):** `UPLOAD_USER`, `UPLOAD_PASS`, `SESSION_SECRET`,
`GITHUB_TOKEN`.

**CORS:** Worker serves only its own same-origin login/upload UI; no cross-origin
access required.

## 9. Geocoding (OSM Nominatim, free)

- Query: `city + ", " + district + ", India"`; fall back to district-only if the
  city lookup fails.
- Respect Nominatim policy: ≤1 req/sec, real `User-Agent` with contact. Worker
  throttles sequentially (~150 groups ≈ up to ~3 min worst case; acceptable for an
  upload action).
- Cache by place string in Cloudflare KV → unchanged places skip re-geocoding on
  later uploads (faster, well under rate limits).
- Failure → `geocodeStatus:"failed"`; group still kept (table + map "not on map"
  panel). Maintainer can add `Lat`/`Lng` in the Excel and re-upload
  (`geocodeStatus:"manual"`).

## 10. Why upload is Excel, not PDF

Auto PDF→Excel for the source document is unreliable:
1. **Broken text encoding** — the PDF uses a legacy (non-Unicode) Hindi font;
   extracted text is garbled (e.g. `चारिũाȏाओंके नाम`). The only fallback is OCR
   with a Hindi model, which is error-prone on dense Devanagari tables and not
   feasible inside a Cloudflare Worker.
2. **Layout reconstruction** — merged cells and multi-member grouping are fragile
   to rebuild from raw PDF positions.

Decision: maintain data as Excel; convert this PDF once to seed it; offer PDF only
as a generated **download**.

## 11. Error handling

- Bad/missing/oversized/wrong-type file → clear Hindi error; no commit.
- Parse errors → reported per row; whole upload rejected if structure is
  unrecognizable (no partial/corrupt publish).
- GitHub commit failure → surfaced; previous `data.json` stays live (only flip
  after a successful commit).
- Geocode service down → upload still completes; all groups `failed`; retry later.
- Frontend missing/empty data → friendly empty state.

## 12. Security model

- Real password + GitHub token live only in Cloudflare server env — not in any
  file a visitor can download. Public repo holds only published *data*.
- Session cookie signed + short-lived; login rate-limited.
- GitHub token fine-grained, single-repo, `contents:write` only.
- Public pages are read-only and contain no credentials or Worker references.
- Phone numbers are public **by explicit choice** (community directory); noted as a
  privacy trade-off, not an oversight.

## 13. Testing

- **Parser unit tests** — sample sheets (multi-member groups, empty `ViharRoute`,
  missing `KM`, edge cases) → assert canonical records. This PDF's data is the
  primary fixture.
- **Geocoding** — mocked Nominatim (success / miss / error); assert status + KV
  cache hits. No live calls in tests.
- **Worker auth** — wrong creds rejected, rate limit triggers, `/upload` requires
  session, expired cookie rejected.
- **Frontend** — render table from fixture JSON; Hindi search filters correctly;
  Excel + PDF downloads work; map plots markers and handles `failed` groups.
- **Manual E2E** — upload real Excel to a staging Worker → verify repo commit →
  public pages refresh.

## 14. Cost

$0 — GitHub Pages (free), Cloudflare Worker + KV (free tier), OpenStreetMap tiles
(free), Nominatim (free, rate-limited).

## 15. Open items for implementation planning

- Choice of client-side PDF generator with a bundled Devanagari font.
- Exact KV namespaces (geocode cache, login rate-limit).
- Wrangler project layout and deploy steps.
- One-time PDF→Excel seed conversion (separate task; manual verification).
