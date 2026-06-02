# Maroon + Gold Identity Redesign + SEO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare Tesla-blue theme with a warm Jain-community "Maroon + Gold" identity, wire in the provided Jain emblem, add a favicon, a footer, a blank Contact page, and baseline SEO/metadata — across the public site and the Worker pages — without touching any tested data/search/geocode/render logic.

**Architecture:** Approach 1 (token swap + light chrome). Change CSS custom properties in `tokens.css`, recolour existing chrome in `app.css`, add an emblem + third nav link + footer to the HTML pages, add SEO `<head>` tags + JSON-LD, recolour the Worker pages, and swap the two map-marker colours via a new pure helper. The data contract, search, geocode, parse, and table-render logic are untouched.

**Tech Stack:** Static HTML/CSS/vanilla ES modules (no bundler), Leaflet (map), Cloudflare Worker (HTML-string pages), Vitest + happy-dom (tests).

**Spec:** `docs/superpowers/specs/2026-06-02-maroon-gold-identity-redesign-design.md`

---

## Constants used throughout this plan

- **Public base URL:** `https://addictedabhi.github.io/Sadhumargi_app/`
- **Palette:** maroon `#7B1E2B`, maroon-dark `#5E121D`, gold `#C99700`, gold-soft `#E0B84C`, cream `#FBF5E9`, cream-band `#F4E7CE`, ochre `#9A6324`.
- **Emblem asset (already present):** `assets/logo.jpg` (white-bg JPG).
- **lastmod date for sitemap:** `2026-06-02`.

## File Structure

**Modify:**
- `assets/css/tokens.css` — palette variables (blue → maroon/gold/cream/ochre).
- `assets/css/app.css` — header band, summary, zone bands, buttons, legend dots, emblem chip, footer, contact-placeholder, responsive.
- `assets/js/map.js` — add pure `markerColor()` helper; use it in `buildMap`.
- `index.html` — SEO head, emblem, third nav link, footer.
- `map.html` — SEO head, emblem, third nav link (active=नक्शा), footer.
- `worker/src/pages.js` — recolour the inline `STYLE` + `uploadForm` style to maroon/gold.
- `worker/test/pages.test.js` — assertion `#3E6AE1` → `#7B1E2B`.
- `assets/js/map.test.js` — **create** (unit test for `markerColor`).

**Create:**
- `contact.html` — themed blank Contact page.
- `robots.txt`, `sitemap.xml` — repo root.

**Untouched (the spine):** `shared/records.js`, `worker/src/parse.js`, `normalize.js`, `geocode.js`, `github.js`, `auth.js`, `assets/js/data.js`, `search.js`, `table.js`, `download.js`.

**Scope note:** the per-row type cell in `table.js` stays plain text (colouring it would require editing tested render logic). The sadhu/sadhvi colour distinction is carried by the map legend dots and map markers only.

---

## Task 1: Palette tokens

**Files:**
- Modify: `assets/css/tokens.css`

- [ ] **Step 1: Replace the entire contents of `assets/css/tokens.css`**

```css
:root {
  --maroon: #7B1E2B;
  --maroon-dark: #5E121D;
  --gold: #C99700;
  --gold-soft: #E0B84C;
  --cream: #FBF5E9;
  --cream-band: #F4E7CE;
  --ochre: #9A6324;
  --dark: #171A20;
  --gray: #393C41;
  --pewter: #5C5E62;
  --silver: #8E8E8E;
  --cloud: #EEEEEE;
  --pale: #D0D1D2;
  --ash: #F4F4F4;
  --white: #FFFFFF;
  --radius: 4px;
  --transition: 0.33s cubic-bezier(0.5, 0, 0, 0.75);
  --font: 'Noto Sans Devanagari', -apple-system, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--font);
  color: var(--dark);
  background: var(--white);
  font-size: 14px;
  line-height: 1.5;
}
a { color: var(--pewter); text-decoration: none; }
a:hover { color: var(--maroon); text-decoration: underline; }
h1 { font-weight: 500; font-size: 22px; }
button, .btn {
  height: 40px; padding: 0 24px; border: 0; border-radius: var(--radius);
  background: var(--maroon); color: #fff; font: inherit; font-weight: 500;
  cursor: pointer; transition: background-color var(--transition);
}
button.secondary, .btn.secondary { background: #fff; color: var(--maroon); border: 1px solid var(--maroon); }
button:hover { background: var(--maroon-dark); }
```

- [ ] **Step 2: Confirm no stray `--blue` references remain**

Run: `grep -rn "var(--blue)\|#3E6AE1\|#3358c4" assets/`
Expected: no matches (empty output).

- [ ] **Step 3: Commit**

```bash
git add assets/css/tokens.css
git commit -m "style: swap palette tokens to maroon+gold identity"
```

---

## Task 2: Page chrome, emblem chip, footer styles

**Files:**
- Modify: `assets/css/app.css`

- [ ] **Step 1: Replace the entire contents of `assets/css/app.css`**

```css
header.topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 24px; background: var(--maroon);
  border-bottom: 3px solid var(--gold);
}
header.topbar .brand-emblem {
  width: 36px; height: 36px; border-radius: 50%;
  background: #fff; padding: 3px; object-fit: contain; flex: 0 0 auto;
}
header.topbar .brand { font-weight: 500; letter-spacing: 1px; color: #fff; font-size: 17px; }
header.topbar nav { margin-left: auto; display: flex; gap: 18px; }
header.topbar nav a { color: var(--cream-band); }
header.topbar nav a:hover { color: #fff; text-decoration: none; }
header.topbar nav a.active { color: #fff; border-bottom: 2px solid var(--gold); padding-bottom: 2px; }

.summary-bar {
  padding: 8px 24px; background: var(--cream); color: var(--gray);
  display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px;
}
.controls { display: flex; gap: 12px; padding: 16px 24px; flex-wrap: wrap; }
.controls input[type="search"], .controls select {
  height: 40px; border: 1px solid var(--pale); border-radius: var(--radius);
  padding: 0 12px; font: inherit; min-width: 240px;
}
.controls input::placeholder { color: var(--silver); }
table.data { border-collapse: collapse; width: 100%; }
table.data th, table.data td {
  border-bottom: 1px solid var(--cloud); padding: 10px 12px;
  text-align: right; vertical-align: top; font-size: 13px;
}
table.data th { color: var(--gray); font-weight: 500; position: sticky; top: 0; background: #fff; }
table.data tr.zone-head td {
  background: var(--cream-band); font-weight: 500; text-align: right;
  color: var(--maroon); border-bottom: 1px solid var(--gold);
}
.member-head { font-weight: 500; }
.empty { padding: 48px 24px; color: var(--silver); text-align: center; }
#map { height: calc(100vh - 220px); width: 100%; }
.legend { display: flex; gap: 16px; padding: 8px 24px; font-size: 13px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 4px; }
.dot.sadhu { background: var(--maroon); }
.dot.sadhvi { background: var(--ochre); }
.failed-panel { padding: 16px 24px; }
.failed-panel ul { color: var(--gray); }

footer.sitefoot {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 24px; margin-top: 24px;
  background: var(--maroon); color: var(--cream-band);
  border-top: 3px solid var(--gold); font-size: 13px;
}
footer.sitefoot .foot-left { flex: 1 1 0; text-align: left; }
footer.sitefoot .foot-center { flex: 1 1 0; text-align: center; }
footer.sitefoot .foot-right { flex: 1 1 0; text-align: right; }
footer.sitefoot a { color: #fff; }
footer.sitefoot a:hover { color: var(--gold-soft); }

.contact-blank { padding: 64px 24px; text-align: center; color: var(--gray); }
.contact-blank h1 { color: var(--maroon); }

@media (max-width: 768px) {
  .controls input[type="search"] { min-width: 100%; }
  table.data th, table.data td { padding: 8px 6px; font-size: 12px; }
  footer.sitefoot { flex-direction: column; gap: 6px; }
  footer.sitefoot .foot-left,
  footer.sitefoot .foot-center,
  footer.sitefoot .foot-right { text-align: center; }
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/css/app.css
git commit -m "style: recolour chrome, add emblem chip + footer styles"
```

---

## Task 3: Map marker colours via a pure helper (TDD)

**Files:**
- Create: `assets/js/map.test.js`
- Modify: `assets/js/map.js`

- [ ] **Step 1: Write the failing test**

Create `assets/js/map.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { markerColor } from './map.js';

describe('markerColor', () => {
  it('returns ochre for sadhvi', () => {
    expect(markerColor('साध्वी')).toBe('#9A6324');
  });
  it('returns maroon for sadhu (and any non-sadhvi)', () => {
    expect(markerColor('साधु')).toBe('#7B1E2B');
    expect(markerColor('')).toBe('#7B1E2B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/map.test.js`
Expected: FAIL — `markerColor` is not exported from `./map.js`.

- [ ] **Step 3: Add the helper and use it in `buildMap`**

In `assets/js/map.js`, add this exported function immediately after the `esc` function (after line 4):

```js
/** Marker/legend colour for a group type. Sadhvi = ochre, everything else = maroon. */
export function markerColor(groupType) {
  return groupType === 'साध्वी' ? '#9A6324' : '#7B1E2B';
}
```

Then in `buildMap`, replace this line:

```js
    const color = r.groupType === 'साध्वी' ? '#c0392b' : '#3E6AE1';
```

with:

```js
    const color = markerColor(r.groupType);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/map.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/map.js assets/js/map.test.js
git commit -m "feat: theme map markers maroon/ochre via pure helper"
```

---

## Task 4: Worker pages theme (TDD)

**Files:**
- Modify: `worker/test/pages.test.js`
- Modify: `worker/src/pages.js`

- [ ] **Step 1: Update the failing assertion in `worker/test/pages.test.js`**

Replace this line (line 11):

```js
    expect(html).toContain('#3E6AE1'); // Tesla electric blue
```

with:

```js
    expect(html).toContain('#7B1E2B'); // maroon identity accent
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/pages.test.js`
Expected: FAIL — login page still contains `#3E6AE1`, not `#7B1E2B`.

- [ ] **Step 3: Recolour the shared `STYLE` constant in `worker/src/pages.js`**

Replace the `STYLE` template (lines 9–27) with:

```js
const STYLE = `
:root{--maroon:#7B1E2B;--maroon-dark:#5E121D;--gold:#C99700;--dark:#171A20;--gray:#393C41;--cream:#FBF5E9}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Devanagari',-apple-system,Arial,sans-serif;
  color:var(--dark);background:#fff;display:flex;min-height:100vh;align-items:center;
  justify-content:center}
.card{width:340px;padding:32px;border-top:3px solid var(--gold)}
h1{font-weight:500;font-size:22px;margin:0 0 24px;color:var(--maroon)}
label{display:block;font-size:14px;color:var(--gray);margin:16px 0 4px}
input{width:100%;height:40px;border:1px solid #D0D1D2;border-radius:4px;padding:0 12px;
  font:inherit}
button{width:100%;height:40px;margin-top:24px;background:var(--maroon);color:#fff;border:0;
  border-radius:4px;font:inherit;font-weight:500;cursor:pointer;
  transition:background-color .33s}
button:hover{background:var(--maroon-dark)}
.err{color:#c0392b;font-size:14px;margin-top:12px}
.summary{max-width:560px;padding:32px;border-top:3px solid var(--gold)}
table{border-collapse:collapse;width:100%;margin-top:16px}
td,th{border-bottom:1px solid #EEE;padding:8px;text-align:right;font-size:14px}
`;
```

- [ ] **Step 4: Recolour the inline style in `uploadForm`**

In `worker/src/pages.js`, inside `uploadForm`, replace this block (the `<style>` content, lines 73–78):

```js
<style>body{font-family:'Noto Sans Devanagari',Arial,sans-serif;color:#171A20;
display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{width:360px;padding:32px}h1{font-weight:500}
input[type=file]{margin:16px 0}button{height:40px;background:#3E6AE1;color:#fff;border:0;
border-radius:4px;padding:0 24px;font:inherit;font-weight:500;cursor:pointer}
.err{color:#c0392b}</style></head><body><div class="card">
```

with:

```js
<style>body{font-family:'Noto Sans Devanagari',Arial,sans-serif;color:#171A20;
display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{width:360px;padding:32px;border-top:3px solid #C99700}h1{font-weight:500;color:#7B1E2B}
input[type=file]{margin:16px 0}button{height:40px;background:#7B1E2B;color:#fff;border:0;
border-radius:4px;padding:0 24px;font:inherit;font-weight:500;cursor:pointer}
.err{color:#c0392b}</style></head><body><div class="card">
```

- [ ] **Step 5: Run the worker page tests to verify they pass**

Run: `npx vitest run worker/test/pages.test.js`
Expected: PASS (all 5 tests — colour assertion now matches, escaping/form assertions unchanged).

- [ ] **Step 6: Commit**

```bash
git add worker/src/pages.js worker/test/pages.test.js
git commit -m "style: theme worker login/upload/result pages maroon+gold"
```

---

## Task 5: Favicon

**Files:**
- (Optional) Create: `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` (repo root)

The public pages link the favicon directly to the existing emblem (`assets/logo.jpg`),
which all modern browsers accept — this is deterministic and needs no tooling. The
`<link>` tags are added in Tasks 6–8. This task only handles an **optional** crisp-icon
enhancement and verifies the baseline.

- [ ] **Step 1: Check whether ImageMagick is available**

Run: `magick -version` (or `convert -version`)
Expected: either version output (tool present) or "command not found".

- [ ] **Step 2a: If ImageMagick IS present — generate a padded square icon set**

Run (pads the tall emblem onto a white square, then resizes):

```bash
magick assets/logo.jpg -resize 256x256 -background white -gravity center -extent 256x256 apple-touch-icon.png
magick apple-touch-icon.png -resize 180x180 apple-touch-icon.png
magick assets/logo.jpg -resize 32x32 -background white -gravity center -extent 32x32 favicon-32.png
magick favicon-32.png -define icon:auto-resize=16,32,48 favicon.ico
```

Then, in the head blocks of Tasks 6–8, **also** add these two lines after the
`assets/logo.jpg` icon link:

```html
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
```

- [ ] **Step 2b: If ImageMagick is NOT present — do nothing here**

The baseline `<link rel="icon" href="assets/logo.jpg">` added in Tasks 6–8 is sufficient.
Skip generation. (The emblem is tall, so the browser tab icon will be slightly
letterboxed — acceptable; a crisp set can be generated later.)

- [ ] **Step 3: Commit (only if files were generated)**

```bash
git add favicon.ico favicon-32.png apple-touch-icon.png
git commit -m "chore: add generated favicon set from emblem"
```

---

## Task 6: index.html — SEO head, emblem, nav, footer

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the `<head>…</head>` block (lines 3–13) with**

```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>विहार सूचना — जैन साधु-साध्वी विहार दिशा-निर्देशिका</title>
  <meta name="description" content="जैन साधु एवं साध्वी भगवंतों के विहार, ठाणा एवं वर्तमान स्थान की निःशुल्क दिशा-निर्देशिका। अंचलवार सूची, खोज एवं नक्शा।">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#7B1E2B">
  <link rel="canonical" href="https://addictedabhi.github.io/Sadhumargi_app/index.html">
  <link rel="icon" href="assets/logo.jpg">
  <link rel="apple-touch-icon" href="assets/logo.jpg">
  <meta property="og:site_name" content="विहार सूचना">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="hi_IN">
  <meta property="og:title" content="विहार सूचना — जैन साधु-साध्वी विहार दिशा-निर्देशिका">
  <meta property="og:description" content="जैन साधु-साध्वी भगवंतों के विहार, ठाणा एवं स्थान की निःशुल्क दिशा-निर्देशिका।">
  <meta property="og:url" content="https://addictedabhi.github.io/Sadhumargi_app/index.html">
  <meta property="og:image" content="https://addictedabhi.github.io/Sadhumargi_app/assets/logo.jpg">
  <meta name="twitter:card" content="summary">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/app.css">
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js"></script>
  <script src="assets/js/noto-vfs.js" onerror="window.__notoMissing=true"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "विहार सूचना",
    "url": "https://addictedabhi.github.io/Sadhumargi_app/",
    "inLanguage": "hi",
    "publisher": {
      "@type": "Organization",
      "name": "Jain Sangh",
      "logo": "https://addictedabhi.github.io/Sadhumargi_app/assets/logo.jpg"
    }
  }
  </script>
</head>
```

*(If Task 5 generated the icon set, also add the two extra `<link>` lines from Task 5 Step 2a right after the `assets/logo.jpg` icon link.)*

- [ ] **Step 2: Replace the `<header class="topbar">…</header>` block (lines 15–21) with**

```html
  <header class="topbar">
    <img class="brand-emblem" src="assets/logo.jpg" alt="जैन प्रतीक चिन्ह" onerror="this.style.display='none'">
    <span class="brand">विहार सूचना</span>
    <nav>
      <a href="index.html" class="active">सूची</a>
      <a href="map.html">नक्शा</a>
      <a href="contact.html">संपर्क</a>
    </nav>
  </header>
```

- [ ] **Step 3: Add the footer immediately before the closing `</table>`'s following `<script type="module">` line**

Insert this block on its own line, directly after `</table>` (after line 36) and before the `<script type="module">` tag:

```html
  <footer class="sitefoot">
    <span class="foot-left">© Jain Sangh 2026</span>
    <span class="foot-center"><a href="https://jainabhishek.com/" target="_blank" rel="noopener noreferrer">jainabhishek.com</a></span>
    <span class="foot-right"><a href="contact.html">संपर्क</a></span>
  </footer>
```

- [ ] **Step 4: Verify the page still loads and the module script is intact**

Run: `grep -n "renderRows\|sitefoot\|brand-emblem\|application/ld" index.html`
Expected: all four present; the `<script type="module">` import block below the footer is unchanged.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add SEO head, emblem, contact nav, footer to index"
```

---

## Task 7: map.html — SEO head, emblem, nav, footer

**Files:**
- Modify: `map.html`

- [ ] **Step 1: Replace the `<head>…</head>` block (lines 3–15) with**

```html
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>नक्शा — विहार सूचना | जैन साधु-साध्वी स्थान</title>
  <meta name="description" content="जैन साधु-साध्वी भगवंतों के विहार स्थानों का नक्शा। OpenStreetMap पर अंचलवार स्थान एवं खोज।">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#7B1E2B">
  <link rel="canonical" href="https://addictedabhi.github.io/Sadhumargi_app/map.html">
  <link rel="icon" href="assets/logo.jpg">
  <link rel="apple-touch-icon" href="assets/logo.jpg">
  <meta property="og:site_name" content="विहार सूचना">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="hi_IN">
  <meta property="og:title" content="नक्शा — विहार सूचना">
  <meta property="og:description" content="जैन साधु-साध्वी भगवंतों के विहार स्थानों का नक्शा।">
  <meta property="og:url" content="https://addictedabhi.github.io/Sadhumargi_app/map.html">
  <meta property="og:image" content="https://addictedabhi.github.io/Sadhumargi_app/assets/logo.jpg">
  <meta name="twitter:card" content="summary">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/app.css">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
</head>
```

*(If Task 5 generated the icon set, also add the two extra `<link>` lines from Task 5 Step 2a right after the `assets/logo.jpg` icon link.)*

- [ ] **Step 2: Replace the `<header class="topbar">…</header>` block (lines 17–23) with**

```html
  <header class="topbar">
    <img class="brand-emblem" src="assets/logo.jpg" alt="जैन प्रतीक चिन्ह" onerror="this.style.display='none'">
    <span class="brand">विहार सूचना</span>
    <nav>
      <a href="index.html">सूची</a>
      <a href="map.html" class="active">नक्शा</a>
      <a href="contact.html">संपर्क</a>
    </nav>
  </header>
```

- [ ] **Step 3: Add the footer directly after `<div class="failed-panel" id="failed"></div>` (line 33) and before the `<script type="module">` tag**

```html
  <footer class="sitefoot">
    <span class="foot-left">© Jain Sangh 2026</span>
    <span class="foot-center"><a href="https://jainabhishek.com/" target="_blank" rel="noopener noreferrer">jainabhishek.com</a></span>
    <span class="foot-right"><a href="contact.html">संपर्क</a></span>
  </footer>
```

- [ ] **Step 4: Verify**

Run: `grep -n "buildMap\|sitefoot\|brand-emblem\|canonical" map.html`
Expected: all four present; the module `<script>` import block below the footer is unchanged.

- [ ] **Step 5: Commit**

```bash
git add map.html
git commit -m "feat: add SEO head, emblem, contact nav, footer to map page"
```

---

## Task 8: contact.html — themed blank page

**Files:**
- Create: `contact.html`

- [ ] **Step 1: Create `contact.html` with this exact content**

```html
<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>संपर्क करें — विहार सूचना</title>
  <meta name="description" content="विहार सूचना से संपर्क करें। यह पृष्ठ शीघ्र उपलब्ध होगा।">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#7B1E2B">
  <link rel="canonical" href="https://addictedabhi.github.io/Sadhumargi_app/contact.html">
  <link rel="icon" href="assets/logo.jpg">
  <link rel="apple-touch-icon" href="assets/logo.jpg">
  <meta property="og:site_name" content="विहार सूचना">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="hi_IN">
  <meta property="og:title" content="संपर्क करें — विहार सूचना">
  <meta property="og:description" content="विहार सूचना से संपर्क करें।">
  <meta property="og:url" content="https://addictedabhi.github.io/Sadhumargi_app/contact.html">
  <meta property="og:image" content="https://addictedabhi.github.io/Sadhumargi_app/assets/logo.jpg">
  <meta name="twitter:card" content="summary">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
  <header class="topbar">
    <img class="brand-emblem" src="assets/logo.jpg" alt="जैन प्रतीक चिन्ह" onerror="this.style.display='none'">
    <span class="brand">विहार सूचना</span>
    <nav>
      <a href="index.html">सूची</a>
      <a href="map.html">नक्शा</a>
      <a href="contact.html" class="active">संपर्क</a>
    </nav>
  </header>
  <main class="contact-blank">
    <h1>संपर्क करें</h1>
    <p>यह पृष्ठ शीघ्र उपलब्ध होगा।</p>
  </main>
  <footer class="sitefoot">
    <span class="foot-left">© Jain Sangh 2026</span>
    <span class="foot-center"><a href="https://jainabhishek.com/" target="_blank" rel="noopener noreferrer">jainabhishek.com</a></span>
    <span class="foot-right"><a href="contact.html">संपर्क</a></span>
  </footer>
</body>
</html>
```

*(If Task 5 generated the icon set, also add the two extra `<link>` lines from Task 5 Step 2a right after the `assets/logo.jpg` icon link.)*

- [ ] **Step 2: Verify**

Run: `grep -n "संपर्क करें\|sitefoot\|class=\"active\"" contact.html`
Expected: heading, footer, and the active contact nav link all present.

- [ ] **Step 3: Commit**

```bash
git add contact.html
git commit -m "feat: add themed blank contact page"
```

---

## Task 9: robots.txt + sitemap.xml

**Files:**
- Create: `robots.txt`, `sitemap.xml` (repo root)

- [ ] **Step 1: Create `robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://addictedabhi.github.io/Sadhumargi_app/sitemap.xml
```

- [ ] **Step 2: Create `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://addictedabhi.github.io/Sadhumargi_app/index.html</loc>
    <lastmod>2026-06-02</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://addictedabhi.github.io/Sadhumargi_app/map.html</loc>
    <lastmod>2026-06-02</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://addictedabhi.github.io/Sadhumargi_app/contact.html</loc>
    <lastmod>2026-06-02</lastmod>
    <priority>0.5</priority>
  </url>
</urlset>
```

- [ ] **Step 3: Commit**

```bash
git add robots.txt sitemap.xml
git commit -m "chore: add robots.txt and sitemap.xml"
```

---

## Task 10: Full sweep + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites PASS — `worker/test/pages.test.js` (5), `assets/js/map.test.js` (2), and every pre-existing suite. Zero failures.

- [ ] **Step 2: Confirm no blue remains anywhere in shipped code**

Run: `grep -rn "#3E6AE1\|#3358c4\|#c0392b" assets/ index.html map.html contact.html worker/src/`
Expected: no matches. (The old marker red `#c0392b` should be gone from `map.js`; the worker `.err` red `#c0392b` is intentionally kept for error text — if that line matches, that is the only acceptable hit. Confirm it is only the `.err` colour.)

- [ ] **Step 3: Manual browser check**

Open `index.html`, `map.html`, and `contact.html` locally (e.g. `npx serve .` or VS Code Live Server). Confirm:
- Maroon header band with the emblem in a white circle chip; gold underline on the active nav link.
- Third nav link `संपर्क` works and is marked active on the contact page.
- Footer shows three slots (© left, jainabhishek.com centre opens in a new tab, संपर्क right) and stacks centred below 768px width.
- Favicon appears in the browser tab.
- Map markers are maroon (sadhu) / ochre (sadhvi); legend dots match.
- Temporarily rename `assets/logo.jpg`; reload — the emblem image disappears, the text wordmark remains, layout intact. Restore the file.

- [ ] **Step 4: Final commit (if any verification fix was needed)**

```bash
git add -A
git commit -m "chore: identity redesign verification fixes"
```

(If Step 3 needed no fixes, skip this commit.)

---

## Self-review notes (coverage against spec)

- §3 tokens → Task 1. §4 chrome → Tasks 2, 3. §5 emblem → Tasks 6–8 (chip + `onerror` fallback). §6 markers → Task 3. §7 favicon → Task 5 (+ links in 6–8). §8 SEO → Tasks 6–8 (+ §8 sitemap/robots in Task 9). §8a nav/footer/contact → Tasks 6, 7, 8. §9 files → covered. §10 testing → Tasks 3, 4, 10. §11 risks → handled (white chip, `onerror`, favicon fallback, a11y check in Step 3).
- Worker pages themed (Task 4) but intentionally get no emblem image and no favicon (self-contained, avoids cross-origin fetch on admin login) — consistent with spec §2/§5.
```
