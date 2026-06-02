# Sadhumargi Vihar Directory App — Implementation Plan

> **Status: SHIPPED (2026-06-02).** All phases implemented; both deploy targets live.
> GitHub Pages serves the public site; the Cloudflare Worker (`sadhumargi-upload`,
> KV bound, 4 secrets set) parses → geocodes → commits successfully. Full pipeline
> verified end-to-end (26 groups / 99 members). Worker URL is unlisted — kept out of
> this file by design. See Phase 10 §E for the one deploy snag hit (token 403).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free-hosted Hindi directory app — public GitHub Pages table + OpenStreetMap pages (Tesla-inspired UI), fed by a password-protected Cloudflare Worker that parses an uploaded Excel, geocodes places, and commits the dataset back to the repo.

**Architecture:** Static frontend (vanilla HTML/CSS/JS, no build) at the repo root, served by GitHub Pages, reads `data/data.json`. A separate Cloudflare Worker (its own unlisted URL) handles login + Excel upload → parse → geocode (Nominatim) → commit `data.json`/`meta.json`/`source.xlsx` to the repo via the GitHub API. Replace-current data model. Downloads available as Excel and PDF.

**Tech Stack:** Node 20, Vitest (unit/DOM tests via `happy-dom`), Cloudflare Workers + Wrangler, SheetJS (`xlsx`), Leaflet + Leaflet.markercluster, pdfmake (with embedded Noto Sans Devanagari), Web Crypto (HMAC sessions).

**Spec:** `docs/superpowers/specs/2026-06-02-sadhumargi-vihar-app-design.md`

---

## File Structure

**Public site (repo root — GitHub Pages):**
```
index.html                  Table page (default route)
map.html                    Map page
assets/css/tokens.css       Tesla design tokens (colors, type, radius, transitions)
assets/css/app.css          Layout + component styles (flat, white, blue accent)
assets/js/data.js           fetch data.json/meta.json; shared helpers (record text, totals)
assets/js/search.js         Hindi-aware filter (pure, testable)
assets/js/table.js          Table page controller
assets/js/map.js            Map page controller (Leaflet + clustering)
assets/js/download.js       Excel + PDF generation (SheetJS, pdfmake)
assets/fonts/NotoSansDevanagari-Regular.ttf   (and -Medium)
data/data.json              Published dataset (Worker overwrites)
data/meta.json              { uploadedAt, fileName, totals, geocodeFailures }
data/source.xlsx            Last uploaded Excel (Excel-download source)
```

**Cloudflare Worker (folder `worker/` — NOT served by Pages):**
```
worker/package.json
worker/wrangler.toml
worker/src/index.js         Router (GET / login, POST /login, POST /upload, GET /logout)
worker/src/auth.js          HMAC signed sessions + per-IP login rate limit
worker/src/parse.js         xlsx ArrayBuffer → canonical records (SheetJS)
worker/src/normalize.js     records → { dataJson, metaJson } + totals + validation
worker/src/geocode.js       geocodeGroups(records, {fetchFn, cache, userAgent})
worker/src/github.js        commitFiles(files, {token, repo, branch, fetchFn})
worker/src/pages.js         HTML strings for login + result pages (Tesla look)
worker/test/*.test.js       Vitest unit tests
```

**Shared logic (used by Worker + seed script):**
```
shared/records.js           Canonical record shape constants + helpers (record→flat text)
```

**Tooling / seed:**
```
tools/seed/seed-records.json  Hand-transcribed canonical records from the source PDF
tools/seed/build-seed.mjs     Generates data/source.xlsx + data/data.json (+ geocodes)
tools/seed/file-cache.mjs     Simple JSON file cache implementing the geocode cache API
```

**Project root tooling:**
```
package.json                Root: vitest + scripts for the whole repo
vitest.config.js
.gitignore
docs/DEPLOY.md              GitHub Pages + Worker deploy + secrets runbook
```

---

## Phase 0 — Project scaffolding

### Task 0.1: Root Node project + Vitest

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sadhumargi-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "node tools/seed/build-seed.mjs"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "happy-dom": "^15.0.0"
  },
  "dependencies": {
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['assets/**', 'happy-dom'],
      ['**/*.dom.test.js', 'happy-dom'],
    ],
    include: ['**/*.test.js'],
    exclude: ['node_modules', 'worker/node_modules'],
  },
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
worker/node_modules/
.dev.vars
.wrangler/
tools/seed/.geocode-cache.json
*.log
```

- [ ] **Step 4: Install deps**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Verify Vitest runs (no tests yet)**

Run: `npm test`
Expected: Vitest reports "No test files found" (exit 0 or 1 — acceptable; confirms Vitest is installed).

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js .gitignore
git commit -m "chore: scaffold root node project with vitest"
```

---

### Task 0.2: Shared canonical record helpers

**Files:**
- Create: `shared/records.js`
- Test: `shared/records.test.js`

- [ ] **Step 1: Write the failing test**

```js
// shared/records.test.js
import { describe, it, expect } from 'vitest';
import { GROUP_TYPES, recordToSearchText, emptyRecord } from './records.js';

describe('records helpers', () => {
  it('exposes the two group types', () => {
    expect(GROUP_TYPES).toEqual(['साधु', 'साध्वी']);
  });

  it('flattens a record into one searchable string', () => {
    const rec = {
      ...emptyRecord(),
      members: ['श्री राजेश मुनि जी म.सा.', 'श्री मधुरमुनिजी म.सा.'],
      place: 'सुराना भवन',
      city: 'नोखागाँव',
      district: 'बीकानेर, राज.',
      activePersons: [{ name: 'गंगाराम जी लुणावत', phone: '8290821152' }],
    };
    const text = recordToSearchText(rec);
    expect(text).toContain('राजेश');
    expect(text).toContain('नोखागाँव');
    expect(text).toContain('गंगाराम');
    expect(text).toContain('8290821152');
  });

  it('normalizes to NFC so equivalent Devanagari forms match', () => {
    const rec = { ...emptyRecord(), city: 'नोखागाँव' };
    const text = recordToSearchText(rec);
    expect(text).toBe(text.normalize('NFC'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/records.test.js`
Expected: FAIL — cannot import from `./records.js` (module not found).

- [ ] **Step 3: Write minimal implementation**

```js
// shared/records.js
export const GROUP_TYPES = ['साधु', 'साध्वी'];

export function emptyRecord() {
  return {
    zone: '', zoneOrder: 0, serial: 0, groupType: 'साधु',
    members: [], thana: null, viharRoute: '', place: '',
    city: '', district: '', km: null,
    viharKarmi: [], activePersons: [],
    lat: null, lng: null, geocodeStatus: 'failed',
  };
}

function contactText(list) {
  return (list || []).map((c) => `${c.name || ''} ${c.phone || ''}`).join(' ');
}

export function recordToSearchText(rec) {
  const parts = [
    rec.zone, rec.groupType, (rec.members || []).join(' '),
    rec.viharRoute, rec.place, rec.city, rec.district,
    rec.km == null ? '' : String(rec.km),
    contactText(rec.viharKarmi), contactText(rec.activePersons),
  ];
  return parts.join(' ').replace(/\s+/g, ' ').trim().normalize('NFC');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/records.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/records.js shared/records.test.js
git commit -m "feat: add shared canonical record helpers"
```

---

## Phase 1 — Excel parsing + normalization (Worker logic)

### Task 1.1: Worker Node project

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "sadhumargi-upload-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.80.0"
  },
  "dependencies": {
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 2: Create `worker/wrangler.toml`**

```toml
name = "sadhumargi-upload"
main = "src/index.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# KV namespaces (IDs filled during deploy — see docs/DEPLOY.md)
# [[kv_namespaces]]
# binding = "GEOCODE_CACHE"
# id = "REPLACE_AFTER_CREATE"

# [[kv_namespaces]]
# binding = "RATE_LIMIT"
# id = "REPLACE_AFTER_CREATE"

[vars]
GITHUB_REPO = "OWNER/REPO"   # set to your repo, e.g. abhishek/Sadhumargi_app
GITHUB_BRANCH = "main"
NOMINATIM_UA = "SadhumargiVihar/1.0 (contact: abhishek.jain@airlinq.com)"

# Secrets (set via `wrangler secret put`): UPLOAD_USER, UPLOAD_PASS,
# SESSION_SECRET, GITHUB_TOKEN
```

- [ ] **Step 3: Install worker deps**

Run: `cd worker; npm install; cd ..`
Expected: `worker/node_modules/` created.

- [ ] **Step 4: Commit**

```bash
git add worker/package.json worker/wrangler.toml
git commit -m "chore: scaffold cloudflare worker project"
```

---

### Task 1.2: Cell splitting helpers (multi-value cells)

**Files:**
- Create: `worker/src/parse.js`
- Test: `worker/test/parse.cells.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/parse.cells.test.js
import { describe, it, expect } from 'vitest';
import { splitLines, parseContacts, parseNumber } from '../src/parse.js';

describe('cell splitting', () => {
  it('splits a multi-line cell into trimmed non-empty lines', () => {
    expect(splitLines('क\nख\n\n  ग ')).toEqual(['क', 'ख', 'ग']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines(null)).toEqual([]);
  });

  it('parses "name + phone" lines into contact objects', () => {
    const cell = 'गंगाराम जी लुणावत\n8290821152\nपंकज जी सुराना\n9413105130';
    expect(parseContacts(cell)).toEqual([
      { name: 'गंगाराम जी लुणावत', phone: '8290821152' },
      { name: 'पंकज जी सुराना', phone: '9413105130' },
    ]);
  });

  it('keeps a name with no following phone', () => {
    expect(parseContacts('संजय जी जैन')).toEqual([
      { name: 'संजय जी जैन', phone: '' },
    ]);
  });

  it('parses numbers and returns null for blanks/non-numeric', () => {
    expect(parseNumber('17.5')).toBe(17.5);
    expect(parseNumber('13')).toBe(13);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('—')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/parse.cells.test.js`
Expected: FAIL — `../src/parse.js` not found.

- [ ] **Step 3: Write minimal implementation**

```js
// worker/src/parse.js
const PHONE_RE = /^[+()\d][\d\s().-]{6,}$/;

export function splitLines(cell) {
  if (cell == null) return [];
  return String(cell)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseContacts(cell) {
  const lines = splitLines(cell);
  const out = [];
  for (const line of lines) {
    const isPhone = PHONE_RE.test(line.replace(/\s+/g, ''));
    if (isPhone && out.length && !out[out.length - 1].phone) {
      out[out.length - 1].phone = line.replace(/\s+/g, '');
    } else {
      out.push({ name: line, phone: '' });
    }
  }
  return out;
}

export function parseNumber(cell) {
  if (cell == null) return null;
  const s = String(cell).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/parse.cells.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/parse.js worker/test/parse.cells.test.js
git commit -m "feat: add excel cell-splitting helpers"
```

---

### Task 1.3: Parse xlsx rows → canonical records

**Files:**
- Modify: `worker/src/parse.js`
- Test: `worker/test/parse.rows.test.js`

The canonical Excel has a header row with columns: `Zone, Serial, GroupType, Members, Thana, ViharRoute, Place, City, District, KM, ViharKarmi, ActivePersons, Lat, Lng`.

- [ ] **Step 1: Write the failing test**

```js
// worker/test/parse.rows.test.js
import { describe, it, expect } from 'vitest';
import { rowsToRecords } from '../src/parse.js';

const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

describe('rowsToRecords', () => {
  it('maps a clean row to a canonical record', () => {
    const rows = [HEADER, [
      '02-बीकानेर-मारवाड़-अंचल', 1, 'साधु',
      'श्री राजेश मुनि जी म.सा.\nश्री मधुरमुनिजी म.सा.', 8, '',
      'सुराना भवन', 'नोखागाँव', 'बीकानेर, राज.', '',
      'गुमान जी\n9482140921', 'गंगाराम जी लुणावत\n8290821152', '', '',
    ]];
    const { records, errors } = rowsToRecords(rows);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.zone).toBe('02-बीकानेर-मारवाड़-अंचल');
    expect(r.zoneOrder).toBe(2);
    expect(r.serial).toBe(1);
    expect(r.groupType).toBe('साधु');
    expect(r.members).toEqual(['श्री राजेश मुनि जी म.सा.', 'श्री मधुरमुनिजी म.सा.']);
    expect(r.thana).toBe(8);
    expect(r.city).toBe('नोखागाँव');
    expect(r.activePersons[0]).toEqual({ name: 'गंगाराम जी लुणावत', phone: '8290821152' });
    expect(r.lat).toBeNull();
    expect(r.geocodeStatus).toBe('failed');
  });

  it('uses provided Lat/Lng and marks status manual', () => {
    const rows = [HEADER, [
      '01-मेवाड़ अंचल', 5, 'साध्वी', 'साध्वी श्री कमल श्री जी म.सा.', 5, '',
      'भंडारी निवास', 'उदयपुर', 'उदयपुर, राज.', '', '', '', '24.5854', '73.7125',
    ]];
    const { records } = rowsToRecords(rows);
    expect(records[0].lat).toBeCloseTo(24.5854);
    expect(records[0].lng).toBeCloseTo(73.7125);
    expect(records[0].geocodeStatus).toBe('manual');
  });

  it('rejects an unrecognizable header', () => {
    const { records, errors } = rowsToRecords([['foo','bar'], ['a','b']]);
    expect(records).toEqual([]);
    expect(errors[0]).toMatch(/header/i);
  });

  it('reports a row missing required City/District but keeps parsing others', () => {
    const rows = [HEADER,
      ['01-मेवाड़ अंचल', 1, 'साधु', 'श्री क मुनि', 2, '', 'स्थान', '', '', '', '', '', '', ''],
      ['01-मेवाड़ अंचल', 2, 'साधु', 'श्री ख मुनि', 3, '', 'स्थान2', 'भीलवाड़ा', 'भीलवाड़ा, राज.', '', '', '', '', ''],
    ];
    const { records, errors } = rowsToRecords(rows);
    expect(records).toHaveLength(1);
    expect(records[0].serial).toBe(2);
    expect(errors.some((e) => /row 2/i.test(e) && /city|district/i.test(e))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/parse.rows.test.js`
Expected: FAIL — `rowsToRecords` not exported.

- [ ] **Step 3: Add implementation to `worker/src/parse.js`**

Append to `worker/src/parse.js`:

```js
import { GROUP_TYPES, emptyRecord } from '../../shared/records.js';

const REQUIRED_HEADER = [
  'Zone','Serial','GroupType','Members','Thana','ViharRoute',
  'Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng',
];

function zoneOrder(zone) {
  const m = String(zone).match(/^\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function rowsToRecords(rows) {
  const errors = [];
  if (!rows || !rows.length) return { records: [], errors: ['empty sheet'] };
  const header = rows[0].map((h) => String(h).trim());
  const ok = REQUIRED_HEADER.every((c, i) => header[i] === c);
  if (!ok) {
    return { records: [], errors: [`unrecognized header: expected ${REQUIRED_HEADER.join(', ')}`] };
  }
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
    const rowNo = i + 1; // 1-based incl. header
    const get = (idx) => (row[idx] == null ? '' : row[idx]);
    const rec = emptyRecord();
    rec.zone = String(get(0)).trim();
    rec.zoneOrder = zoneOrder(rec.zone);
    rec.serial = parseNumber(get(1)) ?? 0;
    rec.groupType = GROUP_TYPES.includes(String(get(2)).trim()) ? String(get(2)).trim() : 'साधु';
    rec.members = splitLines(get(3));
    rec.thana = parseNumber(get(4));
    rec.viharRoute = String(get(5)).trim();
    rec.place = String(get(6)).trim();
    rec.city = String(get(7)).trim();
    rec.district = String(get(8)).trim();
    rec.km = parseNumber(get(9));
    rec.viharKarmi = parseContacts(get(10));
    rec.activePersons = parseContacts(get(11));
    const lat = parseNumber(get(12));
    const lng = parseNumber(get(13));
    if (lat != null && lng != null) {
      rec.lat = lat; rec.lng = lng; rec.geocodeStatus = 'manual';
    }
    if (!rec.city && !rec.district) {
      errors.push(`row ${rowNo}: missing City and District — skipped`);
      continue;
    }
    if (!rec.members.length) {
      errors.push(`row ${rowNo}: no members listed — skipped`);
      continue;
    }
    records.push(rec);
  }
  return { records, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/parse.rows.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/parse.js worker/test/parse.rows.test.js
git commit -m "feat: parse xlsx rows into canonical records"
```

---

### Task 1.4: Read xlsx ArrayBuffer with SheetJS

**Files:**
- Modify: `worker/src/parse.js`
- Test: `worker/test/parse.workbook.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/parse.workbook.test.js
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/parse.js';

function buildXlsx(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

describe('parseWorkbook', () => {
  it('reads an xlsx ArrayBuffer into records', () => {
    const buf = buildXlsx([HEADER, [
      '01-मेवाड़ अंचल', 1, 'साधु', 'श्री क मुनि\nश्री ख मुनि', 2, '',
      'स्थान', 'उदयपुर', 'उदयपुर, राज.', 5, '', 'राम जी\n9999999999', '', '',
    ]]);
    const { records, errors } = parseWorkbook(buf);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].city).toBe('उदयपुर');
    expect(records[0].members).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/parse.workbook.test.js`
Expected: FAIL — `parseWorkbook` not exported.

- [ ] **Step 3: Add implementation to `worker/src/parse.js`**

Add at the top (after existing imports):

```js
import * as XLSX from 'xlsx';
```

Append:

```js
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) return { records: [], errors: ['workbook has no sheets'] };
  const ws = wb.Sheets[first];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  return rowsToRecords(rows);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/parse.workbook.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/parse.js worker/test/parse.workbook.test.js
git commit -m "feat: read xlsx arraybuffer via sheetjs"
```

---

### Task 1.5: Normalize records → data.json + meta totals

**Files:**
- Create: `worker/src/normalize.js`
- Test: `worker/test/normalize.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/normalize.test.js
import { describe, it, expect } from 'vitest';
import { buildOutputs } from '../src/normalize.js';

const recs = [
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 1, groupType: 'साधु',
    members: ['अ', 'ब'], thana: 2, city: 'नोखा', district: 'बीकानेर',
    viharKarmi: [], activePersons: [], lat: 27.5, lng: 73.4, geocodeStatus: 'ok' },
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 2, groupType: 'साध्वी',
    members: ['स'], thana: 1, city: 'X', district: 'बीकानेर',
    viharKarmi: [], activePersons: [], lat: null, lng: null, geocodeStatus: 'failed' },
];

describe('buildOutputs', () => {
  it('produces dataJson sorted by zoneOrder then serial', () => {
    const { dataJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(dataJson.records.map((r) => r.serial)).toEqual([1, 2]);
  });

  it('computes totals (groups, members by type, mapped/failed)', () => {
    const { metaJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(metaJson.totals.groups).toBe(2);
    expect(metaJson.totals.members).toBe(3);
    expect(metaJson.totals.sadhu).toBe(2);
    expect(metaJson.totals.sadhvi).toBe(1);
    expect(metaJson.totals.mapped).toBe(1);
    expect(metaJson.totals.geocodeFailed).toBe(1);
    expect(metaJson.fileName).toBe('x.xlsx');
    expect(metaJson.uploadedAt).toBe('2026-06-02T00:00:00Z');
  });

  it('lists geocode failures with location for manual fixing', () => {
    const { metaJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(metaJson.geocodeFailures).toEqual([
      { zone: '02-बीकानेर', serial: 2, city: 'X', district: 'बीकानेर' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/normalize.test.js`
Expected: FAIL — `buildOutputs` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/normalize.js
export function buildOutputs(records, { fileName, now }) {
  const sorted = [...records].sort(
    (a, b) => a.zoneOrder - b.zoneOrder || a.serial - b.serial,
  );

  const totals = {
    groups: sorted.length,
    members: sorted.reduce((n, r) => n + (r.members?.length || 0), 0),
    sadhu: sorted.filter((r) => r.groupType === 'साधु')
      .reduce((n, r) => n + (r.members?.length || 0), 0),
    sadhvi: sorted.filter((r) => r.groupType === 'साध्वी')
      .reduce((n, r) => n + (r.members?.length || 0), 0),
    mapped: sorted.filter((r) => r.lat != null && r.lng != null).length,
    geocodeFailed: sorted.filter((r) => r.lat == null || r.lng == null).length,
  };

  const geocodeFailures = sorted
    .filter((r) => r.lat == null || r.lng == null)
    .map((r) => ({ zone: r.zone, serial: r.serial, city: r.city, district: r.district }));

  return {
    dataJson: { version: 1, records: sorted },
    metaJson: { version: 1, uploadedAt: now, fileName, totals, geocodeFailures },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/normalize.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/normalize.js worker/test/normalize.test.js
git commit -m "feat: normalize records into data.json and meta totals"
```

---

## Phase 2 — Geocoding (Nominatim + injectable cache)

### Task 2.1: geocodeGroups with cache + throttle

**Files:**
- Create: `worker/src/geocode.js`
- Test: `worker/test/geocode.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/geocode.test.js
import { describe, it, expect, vi } from 'vitest';
import { geocodeGroups, placeKey } from '../src/geocode.js';

function memCache() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? m.get(k) : null), set: async (k, v) => void m.set(k, v) };
}

describe('geocodeGroups', () => {
  it('builds a stable cache key from city + district', () => {
    expect(placeKey({ city: 'नोखा', district: 'बीकानेर, राज.' }))
      .toBe(placeKey({ city: ' नोखा ', district: 'बीकानेर, राज.' }));
  });

  it('keeps manual coords without calling fetch', async () => {
    const fetchFn = vi.fn();
    const recs = [{ city: 'X', district: 'Y', lat: 1, lng: 2, geocodeStatus: 'manual' }];
    const out = await geocodeGroups(recs, { fetchFn, cache: memCache(), userAgent: 'UA', delayMs: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(out[0].geocodeStatus).toBe('manual');
  });

  it('geocodes via fetch and marks ok', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true, json: async () => [{ lat: '27.56', lon: '73.47' }],
    }));
    const recs = [{ city: 'नोखा', district: 'बीकानेर', lat: null, lng: null, geocodeStatus: 'failed' }];
    const out = await geocodeGroups(recs, { fetchFn, cache: memCache(), userAgent: 'UA', delayMs: 0 });
    expect(out[0].lat).toBeCloseTo(27.56);
    expect(out[0].lng).toBeCloseTo(73.47);
    expect(out[0].geocodeStatus).toBe('ok');
    expect(fetchFn.mock.calls[0][1].headers['User-Agent']).toBe('UA');
  });

  it('uses cache on a second identical place (one fetch only)', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => [{ lat: '1', lon: '2' }] }));
    const cache = memCache();
    const recs = [
      { city: 'नोखा', district: 'बीकानेर', lat: null, lng: null, geocodeStatus: 'failed' },
      { city: 'नोखा', district: 'बीकानेर', lat: null, lng: null, geocodeStatus: 'failed' },
    ];
    await geocodeGroups(recs, { fetchFn, cache, userAgent: 'UA', delayMs: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('marks failed when no result, keeps the record', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => [] }));
    const recs = [{ city: 'कहीं नहीं', district: 'कहीं', lat: null, lng: null, geocodeStatus: 'failed' }];
    const out = await geocodeGroups(recs, { fetchFn, cache: memCache(), userAgent: 'UA', delayMs: 0 });
    expect(out[0].geocodeStatus).toBe('failed');
    expect(out[0].lat).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/geocode.test.js`
Expected: FAIL — `worker/src/geocode.js` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/geocode.js
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export function placeKey({ city, district }) {
  return `${(city || '').trim()}|${(district || '').trim()}`.normalize('NFC');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(query, { fetchFn, userAgent }) {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetchFn(url, { headers: { 'User-Agent': userAgent, 'Accept': 'application/json' } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  const lat = Number(arr[0].lat);
  const lng = Number(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function geocodeGroups(records, { fetchFn, cache, userAgent, delayMs = 1100 }) {
  for (const rec of records) {
    if (rec.geocodeStatus === 'manual' && rec.lat != null && rec.lng != null) continue;

    const key = placeKey(rec);
    const cached = await cache.get(key);
    if (cached) {
      rec.lat = cached.lat; rec.lng = cached.lng; rec.geocodeStatus = 'ok';
      continue;
    }

    const queries = [];
    if (rec.city) queries.push(`${rec.city}, ${rec.district}, India`);
    if (rec.district) queries.push(`${rec.district}, India`);

    let hit = null;
    for (const q of queries) {
      hit = await lookup(q, { fetchFn, userAgent });
      await sleep(delayMs); // Nominatim policy: <= 1 req/sec
      if (hit) break;
    }

    if (hit) {
      rec.lat = hit.lat; rec.lng = hit.lng; rec.geocodeStatus = 'ok';
      await cache.set(key, hit);
    } else {
      rec.lat = null; rec.lng = null; rec.geocodeStatus = 'failed';
    }
  }
  return records;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/geocode.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/geocode.js worker/test/geocode.test.js
git commit -m "feat: add nominatim geocoding with cache and throttle"
```

---

## Phase 3 — GitHub commit

### Task 3.1: commitFiles via GitHub Contents API

**Files:**
- Create: `worker/src/github.js`
- Test: `worker/test/github.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/github.test.js
import { describe, it, expect, vi } from 'vitest';
import { commitFiles, toBase64 } from '../src/github.js';

describe('github commit', () => {
  it('base64-encodes UTF-8 (Devanagari safe)', () => {
    const b64 = toBase64('नोखा');
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('नोखा');
  });

  it('PUTs each file with prior sha when the file exists', async () => {
    const fetchFn = vi.fn()
      // GET existing sha for data/data.json
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sha: 'OLDSHA' }) })
      // PUT update
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ commit: { sha: 'NEW' } }) });

    const res = await commitFiles(
      [{ path: 'data/data.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(true);
    const putBody = JSON.parse(fetchFn.mock.calls[1][1].body);
    expect(putBody.sha).toBe('OLDSHA');
    expect(putBody.branch).toBe('main');
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer T');
  });

  it('PUTs without sha when file is new (GET 404)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    const res = await commitFiles(
      [{ path: 'data/new.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(true);
    const putBody = JSON.parse(fetchFn.mock.calls[1][1].body);
    expect(putBody.sha).toBeUndefined();
  });

  it('returns ok:false with detail on PUT failure', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ message: 'bad' }) });
    const res = await commitFiles(
      [{ path: 'data/x.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/422|bad/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/github.test.js`
Expected: FAIL — `worker/src/github.js` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/github.js
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in Workers and Node 18+ globalThis
  return btoa(bin);
}

async function getSha({ repo, path, branch, token, fetchFn }) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sadhumargi-worker',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sha lookup failed: ${res.status}`);
  const json = await res.json();
  return json.sha || null;
}

export async function commitFiles(files, { token, repo, branch, fetchFn, message }) {
  try {
    for (const f of files) {
      const sha = await getSha({ repo, path: f.path, branch, token, fetchFn });
      const body = {
        message,
        content: f.contentBase64,
        branch,
        ...(sha ? { sha } : {}),
      };
      const res = await fetchFn(`https://api.github.com/repos/${repo}/contents/${f.path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'sadhumargi-worker',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).message || ''; } catch { /* ignore */ }
        return { ok: false, error: `PUT ${f.path} failed: ${res.status} ${detail}` };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/github.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/github.js worker/test/github.test.js
git commit -m "feat: commit files to repo via github contents api"
```

---

## Phase 4 — Worker auth (sessions + rate limit)

### Task 4.1: HMAC signed session tokens

**Files:**
- Create: `worker/src/auth.js`
- Test: `worker/test/auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/auth.test.js
import { describe, it, expect } from 'vitest';
import { signSession, verifySession, checkCredentials } from '../src/auth.js';

const SECRET = 'test-secret-value-please-change';

describe('session tokens', () => {
  it('signs then verifies a valid unexpired token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token, SECRET, { now: 1030 });
    expect(res.valid).toBe(true);
    expect(res.user).toBe('admin');
  });

  it('rejects an expired token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 10, now: 1000 });
    const res = await verifySession(token, SECRET, { now: 2000 });
    expect(res.valid).toBe(false);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token + 'x', SECRET, { now: 1010 });
    expect(res.valid).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token, 'other-secret', { now: 1010 });
    expect(res.valid).toBe(false);
  });
});

describe('checkCredentials (constant-time-ish)', () => {
  it('accepts exact match', () => {
    expect(checkCredentials('u', 'p', { user: 'u', pass: 'p' })).toBe(true);
  });
  it('rejects wrong pass and wrong user', () => {
    expect(checkCredentials('u', 'x', { user: 'u', pass: 'p' })).toBe(false);
    expect(checkCredentials('x', 'p', { user: 'u', pass: 'p' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/auth.test.js`
Expected: FAIL — `worker/src/auth.js` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/auth.js
const enc = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(user, secret, { ttlSec, now }) {
  const exp = Math.floor(now) + ttlSec;
  const payload = b64url(enc.encode(JSON.stringify({ user, exp })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token, secret, { now }) {
  if (!token || !token.includes('.')) return { valid: false };
  const [payload, sig] = token.split('.');
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(sig, expected)) return { valid: false };
  let data;
  try { data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))); }
  catch { return { valid: false }; }
  if (typeof data.exp !== 'number' || Math.floor(now) >= data.exp) return { valid: false };
  return { valid: true, user: data.user };
}

export function checkCredentials(user, pass, expected) {
  const u = timingSafeEqual(String(user || ''), String(expected.user || ''));
  const p = timingSafeEqual(String(pass || ''), String(expected.pass || ''));
  return u && p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/auth.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.js worker/test/auth.test.js
git commit -m "feat: add hmac session tokens and credential check"
```

---

### Task 4.2: Per-IP login rate limiter

**Files:**
- Modify: `worker/src/auth.js`
- Test: `worker/test/ratelimit.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/ratelimit.test.js
import { describe, it, expect } from 'vitest';
import { rateLimitHit } from '../src/auth.js';

function memKV() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => void m.set(k, v),
  };
}

describe('rateLimitHit', () => {
  it('allows up to the limit then blocks', async () => {
    const kv = memKV();
    const opts = { kv, ip: '1.2.3.4', limit: 3, windowSec: 900, now: 1000 };
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 1
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 2
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 3
    expect((await rateLimitHit(opts)).blocked).toBe(true);  // 4 -> blocked
  });

  it('resets after the window expires', async () => {
    const kv = memKV();
    await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1000 });
    expect((await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1005 })).blocked).toBe(true);
    expect((await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1020 })).blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/ratelimit.test.js`
Expected: FAIL — `rateLimitHit` not exported.

- [ ] **Step 3: Append implementation to `worker/src/auth.js`**

```js
// Append to worker/src/auth.js
export async function rateLimitHit({ kv, ip, limit, windowSec, now }) {
  const key = `rl:${ip}`;
  const raw = await kv.get(key);
  let rec = raw ? JSON.parse(raw) : null;
  if (!rec || now >= rec.reset) {
    rec = { count: 0, reset: Math.floor(now) + windowSec };
  }
  rec.count += 1;
  await kv.put(key, JSON.stringify(rec), { expiration: rec.reset });
  return { blocked: rec.count > limit, remaining: Math.max(0, limit - rec.count) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/ratelimit.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.js worker/test/ratelimit.test.js
git commit -m "feat: add per-ip login rate limiter"
```

---

## Phase 5 — Worker router + HTML pages

### Task 5.1: Login + result HTML (Tesla look)

**Files:**
- Create: `worker/src/pages.js`
- Test: `worker/test/pages.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/pages.test.js
import { describe, it, expect } from 'vitest';
import { loginPage, resultPage } from '../src/pages.js';

describe('worker html pages', () => {
  it('login page is Hindi, has form posting to /login, no external creds', () => {
    const html = loginPage();
    expect(html).toContain('<form');
    expect(html).toContain('action="/login"');
    expect(html).toContain('method="post"');
    expect(html).toContain('लॉगिन');
    expect(html).toContain('#3E6AE1'); // Tesla electric blue
  });

  it('login page can show an error message', () => {
    expect(loginPage({ error: 'गलत' })).toContain('गलत');
  });

  it('result page lists totals and failures', () => {
    const html = resultPage({
      totals: { groups: 2, members: 3, mapped: 1, geocodeFailed: 1 },
      geocodeFailures: [{ zone: 'Z', serial: 2, city: 'X', district: 'Y' }],
    });
    expect(html).toContain('2');
    expect(html).toContain('नक्शे पर नहीं'); // geocode-failed heading
    expect(html).toContain('X');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/pages.test.js`
Expected: FAIL — `worker/src/pages.js` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/pages.js
const STYLE = `
:root{--blue:#3E6AE1;--dark:#171A20;--gray:#393C41;--ash:#F4F4F4}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Devanagari',-apple-system,Arial,sans-serif;
  color:var(--dark);background:#fff;display:flex;min-height:100vh;align-items:center;
  justify-content:center}
.card{width:340px;padding:32px}
h1{font-weight:500;font-size:22px;margin:0 0 24px}
label{display:block;font-size:14px;color:var(--gray);margin:16px 0 4px}
input{width:100%;height:40px;border:1px solid #D0D1D2;border-radius:4px;padding:0 12px;
  font:inherit}
button{width:100%;height:40px;margin-top:24px;background:var(--blue);color:#fff;border:0;
  border-radius:4px;font:inherit;font-weight:500;cursor:pointer;
  transition:background-color .33s}
.err{color:#c0392b;font-size:14px;margin-top:12px}
.summary{max-width:560px;padding:32px}
table{border-collapse:collapse;width:100%;margin-top:16px}
td,th{border-bottom:1px solid #EEE;padding:8px;text-align:right;font-size:14px}
`;

function shell(title, inner) {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>${inner}</body></html>`;
}

export function loginPage({ error } = {}) {
  return shell('लॉगिन', `<div class="card">
<h1>विहार सूचना — अपलोड लॉगिन</h1>
<form action="/login" method="post">
  <label for="u">उपयोगकर्ता नाम</label>
  <input id="u" name="username" autocomplete="off" required>
  <label for="p">पासवर्ड</label>
  <input id="p" name="password" type="password" required>
  <button type="submit">लॉगिन करें</button>
  ${error ? `<div class="err">${error}</div>` : ''}
</form></div>`);
}

export function resultPage({ totals, geocodeFailures }) {
  const rows = (geocodeFailures || [])
    .map((f) => `<tr><td>${f.zone}</td><td>${f.serial}</td><td>${f.city}</td><td>${f.district}</td></tr>`)
    .join('');
  return shell('अपलोड सफल', `<div class="summary">
<h1>अपलोड सफल</h1>
<p>समूह: ${totals.groups} • सदस्य: ${totals.members} • नक्शे पर: ${totals.mapped} • असफल: ${totals.geocodeFailed}</p>
<h2 style="font-size:16px;font-weight:500">नक्शे पर नहीं (मैन्युअल सुधार करें)</h2>
<table><thead><tr><th>अंचल</th><th>क्र.</th><th>शहर</th><th>जिला</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">कोई नहीं</td></tr>'}</tbody></table>
<p style="margin-top:24px"><a href="/">नया अपलोड</a></p>
</div>`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/pages.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/pages.js worker/test/pages.test.js
git commit -m "feat: add worker login and result html pages"
```

---

### Task 5.2: Router + cookie helpers (unit-testable core)

**Files:**
- Create: `worker/src/index.js`
- Test: `worker/test/router.test.js`

The router’s side-effecting deps (env, geocode, commit) are injected so it is testable without a live Worker. `index.js` exports both the pure `handle(request, env, deps)` and the default Worker `fetch`.

- [ ] **Step 1: Write the failing test**

```js
// worker/test/router.test.js
import { describe, it, expect, vi } from 'vitest';
import { handle, parseCookies, makeSessionCookie } from '../src/index.js';

function memKV() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => void m.set(k, v) };
}
const env = {
  UPLOAD_USER: 'admin', UPLOAD_PASS: 'S3cret!', SESSION_SECRET: 'sek',
  GITHUB_TOKEN: 'T', GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main',
  NOMINATIM_UA: 'UA', RATE_LIMIT: memKV(), GEOCODE_CACHE: memKV(),
};

describe('cookie helpers', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; sess=abc.def')).toEqual({ a: '1', sess: 'abc.def' });
  });
  it('builds an HttpOnly Secure SameSite cookie', () => {
    const c = makeSessionCookie('tok', 7200);
    expect(c).toMatch(/HttpOnly/); expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Strict/); expect(c).toMatch(/Max-Age=7200/);
  });
});

describe('routing', () => {
  const deps = { now: () => 1000, geocodeGroups: vi.fn(async (r) => r), commitFiles: vi.fn(async () => ({ ok: true })), parseWorkbook: vi.fn() };

  it('GET / returns the login page', async () => {
    const res = await handle(new Request('https://w/'), env, deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('लॉगिन');
  });

  it('POST /login with bad creds re-renders with error', async () => {
    const body = new URLSearchParams({ username: 'admin', password: 'WRONG' });
    const res = await handle(new Request('https://w/login', { method: 'POST', body }), env, deps);
    expect(res.status).toBe(401);
    expect(await res.text()).toMatch(/गलत/);
  });

  it('POST /login with good creds sets a session cookie and redirects', async () => {
    const body = new URLSearchParams({ username: 'admin', password: 'S3cret!' });
    const res = await handle(new Request('https://w/login', { method: 'POST', body, headers: { 'CF-Connecting-IP': '1.1.1.1' } }), env, deps);
    expect(res.status).toBe(303);
    expect(res.headers.get('Set-Cookie')).toMatch(/sess=/);
  });

  it('POST /upload without a session is rejected', async () => {
    const res = await handle(new Request('https://w/upload', { method: 'POST' }), env, deps);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run worker/test/router.test.js`
Expected: FAIL — `worker/src/index.js` not found.

- [ ] **Step 3: Write implementation**

```js
// worker/src/index.js
import { loginPage, resultPage } from './pages.js';
import { signSession, verifySession, checkCredentials, rateLimitHit } from './auth.js';
import { parseWorkbook as realParse } from './parse.js';
import { buildOutputs } from './normalize.js';
import { geocodeGroups as realGeocode } from './geocode.js';
import { commitFiles as realCommit, toBase64 } from './github.js';
import * as XLSX from 'xlsx';

const COOKIE = 'sess';
const TTL = 7200;

export function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

export function makeSessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...extra } });
}

async function requireSession(request, env, now) {
  const token = parseCookies(request.headers.get('Cookie'))[COOKIE];
  const res = await verifySession(token, env.SESSION_SECRET, { now });
  return res.valid;
}

export async function handle(request, env, deps = {}) {
  const now = (deps.now || (() => Date.now() / 1000))();
  const parseWorkbook = deps.parseWorkbook || realParse;
  const geocodeGroups = deps.geocodeGroups || realGeocode;
  const commitFiles = deps.commitFiles || realCommit;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') return html(loginPage());

  if (request.method === 'POST' && url.pathname === '/login') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimitHit({ kv: env.RATE_LIMIT, ip, limit: 5, windowSec: 900, now });
    if (rl.blocked) return html(loginPage({ error: 'बहुत अधिक प्रयास — कुछ देर बाद पुनः प्रयास करें' }), 429);
    const form = await request.formData();
    const ok = checkCredentials(form.get('username'), form.get('password'),
      { user: env.UPLOAD_USER, pass: env.UPLOAD_PASS });
    if (!ok) return html(loginPage({ error: 'गलत उपयोगकर्ता नाम या पासवर्ड' }), 401);
    const token = await signSession(String(form.get('username')), env.SESSION_SECRET, { ttlSec: TTL, now });
    return new Response(null, { status: 303, headers: { Location: '/upload', 'Set-Cookie': makeSessionCookie(token, TTL) } });
  }

  if (url.pathname === '/upload') {
    if (!(await requireSession(request, env, now))) {
      if (request.method === 'GET') return html(loginPage({ error: 'कृपया लॉगिन करें' }), 401);
      return html(loginPage({ error: 'सत्र समाप्त — पुनः लॉगिन करें' }), 401);
    }
    if (request.method === 'GET') return html(uploadForm());
    if (request.method === 'POST') {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return html(uploadForm('कोई फ़ाइल नहीं'), 400);
      if (file.size > 5 * 1024 * 1024) return html(uploadForm('फ़ाइल बहुत बड़ी (5MB सीमा)'), 400);
      const name = file.name || '';
      if (!name.toLowerCase().endsWith('.xlsx')) return html(uploadForm('केवल .xlsx फ़ाइल'), 400);

      const buf = await file.arrayBuffer();
      const { records, errors } = parseWorkbook(buf);
      if (!records.length) return html(uploadForm('पार्स विफल: ' + (errors[0] || 'अज्ञात')), 400);

      await geocodeGroups(records, {
        fetchFn: fetch, cache: env.GEOCODE_CACHE, userAgent: env.NOMINATIM_UA,
      });

      const isoNow = new Date(now * 1000).toISOString();
      const { dataJson, metaJson } = buildOutputs(records, { fileName: name, now: isoNow });

      // Re-encode the uploaded xlsx for storage (round-trip ensures it is the parsed sheet)
      const xlsxB64 = arrayBufferToBase64(buf);
      const files = [
        { path: 'data/data.json', contentBase64: toBase64(JSON.stringify(dataJson, null, 2)) },
        { path: 'data/meta.json', contentBase64: toBase64(JSON.stringify(metaJson, null, 2)) },
        { path: 'data/source.xlsx', contentBase64: xlsxB64 },
      ];
      const commit = await commitFiles(files, {
        token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH,
        fetchFn: fetch, message: `data: upload ${name} (${metaJson.totals.groups} groups)`,
      });
      if (!commit.ok) return html(uploadForm('कमिट विफल: ' + commit.error), 502);
      return html(resultPage(metaJson));
    }
  }

  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0` } });
  }

  return html(loginPage({ error: 'पृष्ठ नहीं मिला' }), 404);
}

function uploadForm(error) {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>अपलोड</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans Devanagari',Arial,sans-serif;color:#171A20;
display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{width:360px;padding:32px}h1{font-weight:500}
input[type=file]{margin:16px 0}button{height:40px;background:#3E6AE1;color:#fff;border:0;
border-radius:4px;padding:0 24px;font:inherit;font-weight:500;cursor:pointer}
.err{color:#c0392b}</style></head><body><div class="card">
<h1>एक्सेल अपलोड करें</h1>
<form action="/upload" method="post" enctype="multipart/form-data">
<input type="file" name="file" accept=".xlsx" required><br>
<button type="submit">अपलोड व प्रकाशित करें</button>
${error ? `<p class="err">${error}</p>` : ''}
</form><p><a href="/logout">लॉगआउट</a></p></div></body></html>`;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export default { fetch: (request, env) => handle(request, env) };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run worker/test/router.test.js`
Expected: PASS (6 tests). (`XLSX` import is unused by tested paths but valid.)

- [ ] **Step 5: Run the whole worker suite**

Run: `npx vitest run worker/`
Expected: All worker tests PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.js worker/test/router.test.js
git commit -m "feat: add worker router with auth-gated upload pipeline"
```

---

## Phase 6 — Frontend foundation

### Task 6.1: Design tokens + base CSS

**Files:**
- Create: `assets/css/tokens.css`
- Create: `assets/css/app.css`

- [ ] **Step 1: Create `assets/css/tokens.css`** (Tesla system, per `DESIGN-tesla.md`)

```css
:root {
  --blue: #3E6AE1;
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
a:hover { text-decoration: underline; }
h1 { font-weight: 500; font-size: 22px; }
button, .btn {
  height: 40px; padding: 0 24px; border: 0; border-radius: var(--radius);
  background: var(--blue); color: #fff; font: inherit; font-weight: 500;
  cursor: pointer; transition: background-color var(--transition);
}
button.secondary, .btn.secondary { background: #fff; color: var(--gray); border: 1px solid var(--pale); }
button:hover { background: #3358c4; }
```

- [ ] **Step 2: Create `assets/css/app.css`**

```css
header.topbar {
  display: flex; align-items: center; gap: 24px;
  padding: 12px 24px; border-bottom: 1px solid var(--cloud);
}
header.topbar .brand { font-weight: 500; letter-spacing: 1px; }
header.topbar nav a { margin-right: 16px; color: var(--dark); }
header.topbar nav a.active { color: var(--blue); }
.summary-bar {
  padding: 8px 24px; background: var(--ash); color: var(--gray);
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
table.data tr.zone-head td { background: var(--ash); font-weight: 500; text-align: right; }
.member-head { font-weight: 500; }
.empty { padding: 48px 24px; color: var(--silver); text-align: center; }
#map { height: calc(100vh - 160px); width: 100%; }
.legend { display: flex; gap: 16px; padding: 8px 24px; font-size: 13px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 4px; }
.dot.sadhu { background: var(--blue); }
.dot.sadhvi { background: #c0392b; }
.failed-panel { padding: 16px 24px; }
.failed-panel ul { color: var(--gray); }
@media (max-width: 768px) {
  .controls input[type="search"] { min-width: 100%; }
  table.data th, table.data td { padding: 8px 6px; font-size: 12px; }
}
```

- [ ] **Step 3: Commit**

```bash
git add assets/css/tokens.css assets/css/app.css
git commit -m "feat: add tesla-inspired design tokens and app styles"
```

---

### Task 6.2: Hindi-aware search filter (pure, tested)

**Files:**
- Create: `assets/js/search.js`
- Test: `assets/js/search.dom.test.js`

- [ ] **Step 1: Write the failing test**

```js
// assets/js/search.dom.test.js
import { describe, it, expect } from 'vitest';
import { filterRecords, normalizeQuery } from './search.js';

const recs = [
  { zone: '02-बीकानेर', members: ['श्री राजेश मुनि'], city: 'नोखागाँव', district: 'बीकानेर',
    viharKarmi: [], activePersons: [{ name: 'गंगाराम', phone: '8290821152' }] },
  { zone: '01-मेवाड़', members: ['साध्वी कमल'], city: 'उदयपुर', district: 'उदयपुर',
    viharKarmi: [], activePersons: [] },
];

describe('search', () => {
  it('normalizes query (trim + NFC)', () => {
    expect(normalizeQuery('  नोखा ')).toBe('नोखा'.normalize('NFC'));
  });
  it('returns all records for empty query', () => {
    expect(filterRecords(recs, '').length).toBe(2);
  });
  it('filters by Hindi city substring', () => {
    const out = filterRecords(recs, 'नोखा');
    expect(out).toHaveLength(1);
    expect(out[0].city).toBe('नोखागाँव');
  });
  it('filters by member name', () => {
    expect(filterRecords(recs, 'राजेश')).toHaveLength(1);
  });
  it('filters by phone number', () => {
    expect(filterRecords(recs, '8290821152')).toHaveLength(1);
  });
  it('returns empty when nothing matches', () => {
    expect(filterRecords(recs, 'कोलकाता')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/search.dom.test.js`
Expected: FAIL — `./search.js` not found.

- [ ] **Step 3: Write implementation**

```js
// assets/js/search.js
import { recordToSearchText } from '../../shared/records.js';

export function normalizeQuery(q) {
  return String(q || '').trim().normalize('NFC');
}

export function filterRecords(records, query) {
  const q = normalizeQuery(query);
  if (!q) return records.slice();
  return records.filter((r) => recordToSearchText(r).includes(q));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/search.dom.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/search.js assets/js/search.dom.test.js
git commit -m "feat: add hindi-aware record search filter"
```

---

### Task 6.3: Data loader

**Files:**
- Create: `assets/js/data.js`
- Test: `assets/js/data.dom.test.js`

- [ ] **Step 1: Write the failing test**

```js
// assets/js/data.dom.test.js
import { describe, it, expect, vi } from 'vitest';
import { loadData } from './data.js';

describe('loadData', () => {
  it('returns records + meta on success', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ records: [{ serial: 1 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totals: { groups: 1 }, uploadedAt: 'x' }) });
    const { records, meta, error } = await loadData(fetchFn);
    expect(error).toBeNull();
    expect(records).toHaveLength(1);
    expect(meta.totals.groups).toBe(1);
  });

  it('returns empty + error when data.json is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const { records, error } = await loadData(fetchFn);
    expect(records).toEqual([]);
    expect(error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/data.dom.test.js`
Expected: FAIL — `./data.js` not found.

- [ ] **Step 3: Write implementation**

```js
// assets/js/data.js
export async function loadData(fetchFn = fetch) {
  try {
    const [d, m] = await Promise.all([
      fetchFn('data/data.json', { cache: 'no-cache' }),
      fetchFn('data/meta.json', { cache: 'no-cache' }),
    ]);
    if (!d.ok) return { records: [], meta: null, error: `data.json: ${d.status}` };
    const dataJson = await d.json();
    const meta = m && m.ok ? await m.json() : null;
    return { records: dataJson.records || [], meta, error: null };
  } catch (e) {
    return { records: [], meta: null, error: String(e.message || e) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/data.dom.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/data.js assets/js/data.dom.test.js
git commit -m "feat: add frontend data loader"
```

---

## Phase 7 — Table page

### Task 7.1: Table rendering (DOM, tested)

**Files:**
- Create: `assets/js/table.js`
- Test: `assets/js/table.dom.test.js`

- [ ] **Step 1: Write the failing test**

```js
// assets/js/table.dom.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderRows, populateZones } from './table.js';

const recs = [
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 1, groupType: 'साधु',
    members: ['श्री राजेश मुनि', 'श्री मधुर मुनि'], thana: 8, viharRoute: '',
    place: 'सुराना भवन', city: 'नोखागाँव', district: 'बीकानेर', km: null,
    viharKarmi: [], activePersons: [{ name: 'गंगाराम', phone: '8290821152' }] },
  { zone: '01-मेवाड़', zoneOrder: 1, serial: 3, groupType: 'साध्वी',
    members: ['साध्वी कमल'], thana: 5, viharRoute: 'अ से ब', place: 'भवन',
    city: 'उदयपुर', district: 'उदयपुर', km: 12,
    viharKarmi: [], activePersons: [] },
];

beforeEach(() => { document.body.innerHTML = '<table class="data"><tbody id="rows"></tbody></table><select id="zone"></select>'; });

describe('table render', () => {
  it('renders one row per record with head member bold', () => {
    renderRows(recs, document.getElementById('rows'));
    const dataRows = document.querySelectorAll('#rows tr.data-row');
    expect(dataRows.length).toBe(2);
    expect(document.querySelector('.member-head').textContent).toContain('राजेश');
  });

  it('renders phone as a tel: link', () => {
    renderRows(recs, document.getElementById('rows'));
    const tel = document.querySelector('a[href^="tel:"]');
    expect(tel).toBeTruthy();
    expect(tel.getAttribute('href')).toBe('tel:8290821152');
  });

  it('inserts a zone header row when zone changes', () => {
    renderRows(recs, document.getElementById('rows'));
    expect(document.querySelectorAll('#rows tr.zone-head').length).toBe(2);
  });

  it('shows an empty state when no records', () => {
    renderRows([], document.getElementById('rows'));
    expect(document.querySelector('#rows .empty, #rows td').textContent).toContain('कोई');
  });

  it('populates the zone filter with unique zones', () => {
    populateZones(recs, document.getElementById('zone'));
    const opts = [...document.querySelectorAll('#zone option')].map((o) => o.textContent);
    expect(opts).toContain('सभी अंचल');
    expect(opts).toContain('02-बीकानेर');
    expect(opts).toContain('01-मेवाड़');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/table.dom.test.js`
Expected: FAIL — `./table.js` not found.

- [ ] **Step 3: Write implementation**

```js
// assets/js/table.js
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function membersHtml(members) {
  return members.map((m, i) =>
    `<div class="${i === 0 ? 'member-head' : ''}">${esc(m)}</div>`).join('');
}

function contactsHtml(list) {
  return list.map((c) => {
    const phone = (c.phone || '').replace(/\s+/g, '');
    const tel = phone ? ` <a href="tel:${esc(phone)}">${esc(phone)}</a>` : '';
    return `<div>${esc(c.name)}${tel}</div>`;
  }).join('');
}

export function renderRows(records, tbody) {
  tbody.innerHTML = '';
  if (!records.length) {
    tbody.innerHTML = '<tr><td class="empty" colspan="11">कोई डेटा उपलब्ध नहीं</td></tr>';
    return;
  }
  let lastZone = null;
  for (const r of records) {
    if (r.zone !== lastZone) {
      lastZone = r.zone;
      const zh = document.createElement('tr');
      zh.className = 'zone-head';
      zh.innerHTML = `<td colspan="11">${esc(r.zone)}</td>`;
      tbody.appendChild(zh);
    }
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = [
      esc(r.serial), esc(r.groupType), membersHtml(r.members), esc(r.thana ?? ''),
      esc(r.viharRoute), esc(r.place), esc(r.city), esc(r.district),
      esc(r.km ?? ''), contactsHtml(r.viharKarmi), contactsHtml(r.activePersons),
    ].map((c) => `<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  }
}

export function populateZones(records, select) {
  const zones = [...new Set(records.map((r) => r.zone))];
  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = ''; all.textContent = 'सभी अंचल';
  select.appendChild(all);
  for (const z of zones) {
    const o = document.createElement('option');
    o.value = z; o.textContent = z;
    select.appendChild(o);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/table.dom.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/table.js assets/js/table.dom.test.js
git commit -m "feat: add table rendering and zone filter"
```

---

### Task 7.2: Excel + PDF download

**Files:**
- Create: `assets/js/download.js`
- Test: `assets/js/download.dom.test.js`

- [ ] **Step 1: Write the failing test**

```js
// assets/js/download.dom.test.js
import { describe, it, expect } from 'vitest';
import { recordsToAoa } from './download.js';

describe('recordsToAoa', () => {
  it('produces a header row matching the canonical template', () => {
    const aoa = recordsToAoa([]);
    expect(aoa[0]).toEqual(['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng']);
  });

  it('serializes a record with newline-joined members and contacts', () => {
    const aoa = recordsToAoa([{
      zone: 'Z', serial: 1, groupType: 'साधु', members: ['अ', 'ब'], thana: 2,
      viharRoute: '', place: 'प', city: 'श', district: 'ज', km: 5,
      viharKarmi: [{ name: 'क', phone: '1' }],
      activePersons: [{ name: 'ग', phone: '2' }, { name: 'घ', phone: '3' }],
      lat: 24.5, lng: 73.7,
    }]);
    const row = aoa[1];
    expect(row[3]).toBe('अ\nब');
    expect(row[10]).toBe('क\n1');
    expect(row[11]).toBe('ग\n2\nघ\n3');
    expect(row[12]).toBe(24.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/download.dom.test.js`
Expected: FAIL — `./download.js` not found.

- [ ] **Step 3: Write implementation**

`xlsx` and `pdfmake` are loaded globally via CDN `<script>` in `index.html` (`window.XLSX`, `window.pdfMake`). `recordsToAoa` is pure and testable; the export functions use the globals.

```js
// assets/js/download.js
const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

function contactsCell(list) {
  return (list || []).flatMap((c) => [c.name, c.phone].filter((x) => x != null && x !== '')).join('\n');
}

export function recordsToAoa(records) {
  const rows = [HEADER.slice()];
  for (const r of records) {
    rows.push([
      r.zone, r.serial, r.groupType, (r.members || []).join('\n'), r.thana ?? '',
      r.viharRoute || '', r.place || '', r.city || '', r.district || '', r.km ?? '',
      contactsCell(r.viharKarmi), contactsCell(r.activePersons),
      r.lat ?? '', r.lng ?? '',
    ]);
  }
  return rows;
}

export function downloadExcel(records, filename = 'vihar-suchna.xlsx') {
  const ws = window.XLSX.utils.aoa_to_sheet(recordsToAoa(records));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Vihar');
  window.XLSX.writeFile(wb, filename);
}

export function downloadPdf(records, meta) {
  // pdfMake.vfs + a Noto Sans Devanagari font are registered in index.html (see Task 7.3)
  const body = [['अंचल', 'क्र.', 'नाम', 'स्थान', 'शहर', 'जिला']];
  for (const r of records) {
    body.push([r.zone, String(r.serial), (r.members || []).join(', '),
      r.place || '', r.city || '', r.district || '']);
  }
  const doc = {
    defaultStyle: { font: 'NotoDeva', fontSize: 8 },
    pageOrientation: 'landscape',
    content: [
      { text: 'विहार सूचना', fontSize: 14, margin: [0, 0, 0, 8] },
      meta ? { text: `अंतिम अपडेट: ${meta.uploadedAt || ''}`, fontSize: 8, margin: [0, 0, 0, 8] } : {},
      { table: { headerRows: 1, widths: ['*', 'auto', '*', '*', 'auto', 'auto'], body } },
    ],
  };
  window.pdfMake.createPdf(doc).download('vihar-suchna.pdf');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/download.dom.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/download.js assets/js/download.dom.test.js
git commit -m "feat: add excel and pdf download generation"
```

---

### Task 7.3: index.html (table page) wiring

**Files:**
- Create: `index.html`

The Noto Sans Devanagari font for pdfmake is registered via a small generated VFS file (`assets/js/noto-vfs.js`) produced in Task 9.0; until then the PDF button still works for Latin text and Devanagari falls back. The page imports ES modules for table logic.

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>विहार सूचना — सूची</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/app.css">
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js"></script>
  <script src="assets/js/noto-vfs.js" onerror="window.__notoMissing=true"></script>
</head>
<body>
  <header class="topbar">
    <span class="brand">विहार सूचना</span>
    <nav>
      <a href="index.html" class="active">सूची</a>
      <a href="map.html">नक्शा</a>
    </nav>
  </header>
  <div class="summary-bar" id="summary"></div>
  <div class="controls">
    <input type="search" id="q" placeholder="खोजें: नाम, शहर या जिला...">
    <select id="zone"></select>
    <button id="dl-excel">Excel डाउनलोड</button>
    <button id="dl-pdf" class="secondary">PDF डाउनलोड</button>
  </div>
  <table class="data">
    <thead><tr>
      <th>क्र.स.</th><th>प्रकार</th><th>नाम</th><th>ठाणा</th><th>विहार मार्ग</th>
      <th>स्थान</th><th>गाँव/शहर</th><th>जिला</th><th>किमी</th>
      <th>विहारकर्मी</th><th>सक्रिय व्यक्ति</th>
    </tr></thead>
    <tbody id="rows"></tbody>
  </table>

  <script type="module">
    import { loadData } from './assets/js/data.js';
    import { filterRecords } from './assets/js/search.js';
    import { renderRows, populateZones } from './assets/js/table.js';
    import { downloadExcel, downloadPdf } from './assets/js/download.js';

    const elQ = document.getElementById('q');
    const elZone = document.getElementById('zone');
    const elRows = document.getElementById('rows');
    const elSummary = document.getElementById('summary');

    const { records, meta, error } = await loadData();
    if (error) {
      elSummary.textContent = 'डेटा लोड नहीं हुआ';
    } else if (meta && meta.totals) {
      const t = meta.totals;
      elSummary.innerHTML =
        `<span>कुल समूह: ${t.groups}</span><span>कुल साधु-साध्वी: ${t.members}</span>` +
        `<span>नक्शे पर: ${t.mapped}</span>` +
        `<span>अंतिम अपडेट: ${meta.uploadedAt || ''}</span>`;
    }
    populateZones(records, elZone);

    function apply() {
      let out = filterRecords(records, elQ.value);
      if (elZone.value) out = out.filter((r) => r.zone === elZone.value);
      renderRows(out, elRows);
    }
    elQ.addEventListener('input', apply);
    elZone.addEventListener('change', apply);
    document.getElementById('dl-excel').addEventListener('click', () => downloadExcel(records));
    document.getElementById('dl-pdf').addEventListener('click', () => downloadPdf(records, meta));
    apply();
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual smoke check**

Create a tiny `data/data.json` fixture if none exists yet:
```bash
mkdir -p data
printf '%s' '{"version":1,"records":[]}' > data/data.json
printf '%s' '{"version":1,"totals":{"groups":0,"members":0,"mapped":0},"uploadedAt":""}' > data/meta.json
```
Serve locally: `npx serve .` (or `python -m http.server`), open `index.html`.
Expected: page loads, Hindi UI, empty state "कोई डेटा उपलब्ध नहीं", no console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html data/data.json data/meta.json
git commit -m "feat: add table page with search, filter, downloads"
```

---

## Phase 8 — Map page

### Task 8.1: Marker builder (pure, tested)

**Files:**
- Create: `assets/js/map.js`
- Test: `assets/js/map.dom.test.js`

- [ ] **Step 1: Write the failing test**

```js
// assets/js/map.dom.test.js
import { describe, it, expect } from 'vitest';
import { mappable, popupHtml, failedList } from './map.js';

const recs = [
  { zone: 'Z', serial: 1, groupType: 'साधु', members: ['अ', 'ब'], place: 'प',
    city: 'श', district: 'ज', km: 5, viharRoute: '', viharKarmi: [],
    activePersons: [{ name: 'ग', phone: '99' }], lat: 27.5, lng: 73.4, geocodeStatus: 'ok' },
  { zone: 'Z', serial: 2, groupType: 'साध्वी', members: ['स'], place: 'प2',
    city: 'X', district: 'Y', km: null, viharRoute: '', viharKarmi: [],
    activePersons: [], lat: null, lng: null, geocodeStatus: 'failed' },
];

describe('map helpers', () => {
  it('mappable keeps only records with coordinates', () => {
    expect(mappable(recs)).toHaveLength(1);
    expect(mappable(recs)[0].serial).toBe(1);
  });
  it('popupHtml includes head name, place, and a tel link', () => {
    const html = popupHtml(recs[0]);
    expect(html).toContain('अ');
    expect(html).toContain('प');
    expect(html).toContain('tel:99');
  });
  it('failedList returns the un-geocoded records', () => {
    const f = failedList(recs);
    expect(f).toHaveLength(1);
    expect(f[0].city).toBe('X');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run assets/js/map.dom.test.js`
Expected: FAIL — `./map.js` not found.

- [ ] **Step 3: Write implementation**

```js
// assets/js/map.js
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mappable(records) {
  return records.filter((r) => r.lat != null && r.lng != null);
}

export function failedList(records) {
  return records.filter((r) => r.lat == null || r.lng == null);
}

export function popupHtml(r) {
  const contacts = (r.activePersons || []).map((c) => {
    const phone = (c.phone || '').replace(/\s+/g, '');
    return `${esc(c.name)}${phone ? ` <a href="tel:${esc(phone)}">${esc(phone)}</a>` : ''}`;
  }).join('<br>');
  return `<div class="popup">
    <strong>${esc((r.members || [])[0] || '')}</strong>
    ${r.members && r.members.length > 1 ? ` (+${r.members.length - 1})` : ''}<br>
    ${esc(r.place)}, ${esc(r.city)}<br>${esc(r.district)}
    ${r.km != null ? `<br>किमी: ${esc(r.km)}` : ''}
    ${r.viharRoute ? `<br>${esc(r.viharRoute)}` : ''}
    ${contacts ? `<br>${contacts}` : ''}
  </div>`;
}

// Wires Leaflet (window.L) + markercluster. Called from map.html.
export function buildMap(records, { L, elId = 'map' }) {
  const map = L.map(elId).setView([23.5, 78.5], 5); // India
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const cluster = L.markerClusterGroup();
  const byId = new Map();
  for (const r of mappable(records)) {
    const color = r.groupType === 'साध्वी' ? '#c0392b' : '#3E6AE1';
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 7, color, fillColor: color, fillOpacity: 0.9, weight: 1,
    }).bindPopup(popupHtml(r));
    cluster.addLayer(marker);
    byId.set(`${r.zone}|${r.serial}`, { r, marker });
  }
  map.addLayer(cluster);
  return { map, cluster, byId };
}

export function filterMarkers(state, matched, L) {
  const ids = new Set(matched.map((r) => `${r.zone}|${r.serial}`));
  state.cluster.clearLayers();
  for (const [id, { marker }] of state.byId) {
    if (ids.has(id)) state.cluster.addLayer(marker);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run assets/js/map.dom.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add assets/js/map.js assets/js/map.dom.test.js
git commit -m "feat: add map marker builder and helpers"
```

---

### Task 8.2: map.html wiring

**Files:**
- Create: `map.html`

- [ ] **Step 1: Create `map.html`**

```html
<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>विहार सूचना — नक्शा</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/app.css">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
</head>
<body>
  <header class="topbar">
    <span class="brand">विहार सूचना</span>
    <nav>
      <a href="index.html">सूची</a>
      <a href="map.html" class="active">नक्शा</a>
    </nav>
  </header>
  <div class="summary-bar" id="summary"></div>
  <div class="controls">
    <input type="search" id="q" placeholder="खोजें: नाम, शहर या जिला...">
  </div>
  <div class="legend">
    <span><span class="dot sadhu"></span> साधु</span>
    <span><span class="dot sadhvi"></span> साध्वी</span>
  </div>
  <div id="map"></div>
  <div class="failed-panel" id="failed"></div>

  <script type="module">
    import { loadData } from './assets/js/data.js';
    import { filterRecords } from './assets/js/search.js';
    import { buildMap, filterMarkers, failedList } from './assets/js/map.js';

    const { records, meta, error } = await loadData();
    const elSummary = document.getElementById('summary');
    if (error) elSummary.textContent = 'डेटा लोड नहीं हुआ';
    else if (meta && meta.totals) {
      const t = meta.totals;
      elSummary.innerHTML = `<span>नक्शे पर: ${t.mapped}</span><span>कुल समूह: ${t.groups}</span>`;
    }

    const state = buildMap(records, { L: window.L });

    const failed = failedList(records);
    document.getElementById('failed').innerHTML = failed.length
      ? `<h2 style="font-size:16px;font-weight:500">नक्शे पर नहीं (${failed.length})</h2><ul>` +
        failed.map((r) => `<li>${r.zone} — ${r.place}, ${r.city}, ${r.district}</li>`).join('') + '</ul>'
      : '';

    document.getElementById('q').addEventListener('input', (e) => {
      const matched = filterRecords(records, e.target.value);
      filterMarkers(state, matched, window.L);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual smoke check**

Serve locally (`npx serve .`), open `map.html`.
Expected: India map renders with OSM tiles, no console errors, empty (no markers) with the empty fixture, legend visible.

- [ ] **Step 3: Commit**

```bash
git add map.html
git commit -m "feat: add map page with clustering, search, failed panel"
```

---

## Phase 9 — Seed data (one-time PDF → canonical)

### Task 9.0: Generate the Noto Sans Devanagari pdfmake VFS

**Files:**
- Create: `assets/fonts/NotoSansDevanagari-Regular.ttf` (downloaded)
- Create: `tools/build-noto-vfs.mjs`
- Create: `assets/js/noto-vfs.js` (generated)

- [ ] **Step 1: Download the font**

```bash
mkdir -p assets/fonts
curl -L -o assets/fonts/NotoSansDevanagari-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf"
```
Expected: a `.ttf` file > 100KB exists.

- [ ] **Step 2: Create `tools/build-noto-vfs.mjs`**

```js
// tools/build-noto-vfs.mjs — embeds the TTF into a pdfmake VFS file
import { readFileSync, writeFileSync } from 'node:fs';

const ttf = readFileSync('assets/fonts/NotoSansDevanagari-Regular.ttf').toString('base64');
const out = `// AUTO-GENERATED by tools/build-noto-vfs.mjs
window.pdfMake = window.pdfMake || {};
window.pdfMake.vfs = Object.assign(window.pdfMake.vfs || {}, {
  'NotoSansDevanagari-Regular.ttf': '${ttf}'
});
window.pdfMake.fonts = Object.assign(window.pdfMake.fonts || {}, {
  NotoDeva: {
    normal: 'NotoSansDevanagari-Regular.ttf',
    bold: 'NotoSansDevanagari-Regular.ttf',
    italics: 'NotoSansDevanagari-Regular.ttf',
    bolditalics: 'NotoSansDevanagari-Regular.ttf'
  }
});
`;
writeFileSync('assets/js/noto-vfs.js', out);
console.log('wrote assets/js/noto-vfs.js');
```

- [ ] **Step 3: Generate the VFS**

Run: `node tools/build-noto-vfs.mjs`
Expected: `assets/js/noto-vfs.js` created. (This unblocks Devanagari PDF rendering referenced in Task 7.2/7.3.)

- [ ] **Step 4: Manual check — PDF download renders Hindi**

Serve locally, open `index.html`, click "PDF डाउनलोड" (use a non-empty fixture if available).
Expected: a PDF downloads with readable Devanagari text.

- [ ] **Step 5: Commit**

```bash
git add tools/build-noto-vfs.mjs assets/js/noto-vfs.js assets/fonts/NotoSansDevanagari-Regular.ttf
git commit -m "build: embed noto sans devanagari font for pdf export"
```

---

### Task 9.1: Transcribe the PDF into canonical seed records

**Files:**
- Create: `tools/seed/seed-records.json`

The source PDF (`30.05.2026 vihar suchna.pdf`) uses a legacy font, so this is **manual transcription** (content work, not code). Transcribe every group from the rendered PDF into the canonical record shape. Below is the **first zone fully transcribed** as the authoritative pattern — replicate the structure for all remaining zones/groups (01-मेवाड़, 03-जयपुर-ब्यावर, 04-मध्यप्रदेश, 05-छत्तीसगढ़-उड़ीसा, 06-कर्नाटक-आंध्रप्रदेश, 07-तमिलनाडु, 08-मुंबई-गुजरात, 09-महाराष्ट्र-खानदेश-विदर्भ, 10-बंगाल-बिहार-नेपाल-भूटान, 12-दिल्ली-पंजाब-हरियाणा).

- [ ] **Step 1: Create `tools/seed/seed-records.json` (start with this verified pattern)**

```json
{
  "version": 1,
  "records": [
    {
      "zone": "02-बीकानेर-मारवाड़-अंचल", "zoneOrder": 2, "serial": 1, "groupType": "साधु",
      "members": [
        "आचार्य प्रवर श्री रामलाल जी म.सा.",
        "उपाध्याय श्री राजेश मुनि जी म.सा.",
        "श्री मधुरमुनि जी म.सा.", "श्री गगन मुनि जी म.सा.",
        "श्री शोभन मुनि जी म.सा.", "श्री गुणीश मुनि जी म.सा.",
        "श्री रामचरण मुनि जी म.सा.", "श्री रामपुलक मुनि जी म.सा."
      ],
      "thana": 8, "viharRoute": "", "place": "सुराना भवन",
      "city": "नोखागाँव", "district": "बीकानेर, राज.", "km": null,
      "viharKarmi": [{ "name": "गुमान जी", "phone": "9482140921" }],
      "activePersons": [
        { "name": "गंगाराम जी लुणावत", "phone": "8290821152" },
        { "name": "पंकज जी सुराना", "phone": "9413105130" },
        { "name": "महेश जी नाहटा", "phone": "9406201351" }
      ],
      "lat": null, "lng": null, "geocodeStatus": "failed"
    },
    {
      "zone": "02-बीकानेर-मारवाड़-अंचल", "zoneOrder": 2, "serial": 2, "groupType": "साधु",
      "members": [
        "शासन दीपक श्री वीरेन्द्र मुनि जी म.सा.", "श्री प्रकाशमुनि जी म.सा.",
        "श्री गौतम मुनि जी म.सा.", "श्री प्रशम मुनि जी म.सा.",
        "श्री चंद्रेश मुनि जी म.सा.", "श्री किशोर मुनि जी म.सा.",
        "श्री प्राणेश मुनि जी म.सा.", "श्री जयेश मुनि जी म.सा.",
        "श्री लाघव मुनि जी म.सा.", "श्री ऋषिकेश मुनि जी म.सा.",
        "श्री मंगल मुनि जी म.सा.", "श्री रामसौरभ मुनि जी म.सा.",
        "श्री रामसूर्य मुनि जी म.सा."
      ],
      "thana": 13, "viharRoute": "", "place": "सेठिया कोटड़ी",
      "city": "मरोठी सेठिया मोहल्ला, ठठेरा बाजार", "district": "बीकानेर, राज.", "km": null,
      "viharKarmi": [],
      "activePersons": [
        { "name": "अंकित जी बांठिया", "phone": "8905909991" },
        { "name": "मुकेश जी बुच्चा", "phone": "9462600753" }
      ],
      "lat": null, "lng": null, "geocodeStatus": "failed"
    }
  ]
}
```

- [ ] **Step 2: Complete the transcription**

Add the remaining groups for all zones from the PDF, following the exact same object shape. Verify the running totals at the end match the PDF (कुल साधु-साध्वी 546, कुल संत 95). This is a data-entry step — no code changes.

- [ ] **Step 3: Validate the JSON**

Run: `node -e "const d=require('./tools/seed/seed-records.json'); console.log(d.records.length+' records')"`
Expected: prints the record count, no JSON parse error.

- [ ] **Step 4: Commit**

```bash
git add tools/seed/seed-records.json
git commit -m "data: add transcribed canonical seed records from pdf"
```

---

### Task 9.2: Build-seed script (geocode + emit data.json + source.xlsx)

**Files:**
- Create: `tools/seed/file-cache.mjs`
- Create: `tools/seed/build-seed.mjs`

- [ ] **Step 1: Create `tools/seed/file-cache.mjs`**

```js
// tools/seed/file-cache.mjs — geocode cache backed by a JSON file (same get/set API as KV)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PATH = 'tools/seed/.geocode-cache.json';

export function fileCache() {
  const data = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : {};
  return {
    get: async (k) => (k in data ? data[k] : null),
    set: async (k, v) => { data[k] = v; writeFileSync(PATH, JSON.stringify(data, null, 2)); },
  };
}
```

- [ ] **Step 2: Create `tools/seed/build-seed.mjs`**

```js
// tools/seed/build-seed.mjs
// Reads tools/seed/seed-records.json, geocodes, writes data/data.json,
// data/meta.json, and data/source.xlsx (canonical template).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { geocodeGroups } from '../../worker/src/geocode.js';
import { buildOutputs } from '../../worker/src/normalize.js';
import { fileCache } from './file-cache.mjs';

const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

function contactsCell(list) {
  return (list || []).flatMap((c) => [c.name, c.phone].filter((x) => x)).join('\n');
}
function toAoa(records) {
  const rows = [HEADER.slice()];
  for (const r of records) {
    rows.push([
      r.zone, r.serial, r.groupType, (r.members || []).join('\n'), r.thana ?? '',
      r.viharRoute || '', r.place || '', r.city || '', r.district || '', r.km ?? '',
      contactsCell(r.viharKarmi), contactsCell(r.activePersons), r.lat ?? '', r.lng ?? '',
    ]);
  }
  return rows;
}

const { records } = JSON.parse(readFileSync('tools/seed/seed-records.json', 'utf8'));

await geocodeGroups(records, {
  fetchFn: fetch,
  cache: fileCache(),
  userAgent: 'SadhumargiVihar/1.0 (contact: abhishek.jain@airlinq.com)',
  delayMs: 1100,
});

const now = new Date().toISOString();
const { dataJson, metaJson } = buildOutputs(records, { fileName: 'seed.xlsx', now });

mkdirSync('data', { recursive: true });
writeFileSync('data/data.json', JSON.stringify(dataJson, null, 2));
writeFileSync('data/meta.json', JSON.stringify(metaJson, null, 2));

const ws = XLSX.utils.aoa_to_sheet(toAoa(dataJson.records));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Vihar');
XLSX.writeFile(wb, 'data/source.xlsx');

console.log(`seed built: ${dataJson.records.length} groups, ` +
  `${metaJson.totals.mapped} mapped, ${metaJson.totals.geocodeFailed} failed`);
```

- [ ] **Step 3: Run the seed build**

Run: `node tools/seed/build-seed.mjs`
Expected: console prints group counts; `data/data.json`, `data/meta.json`, `data/source.xlsx` written. Geocoding takes ~1s per unique place (cached afterward). Review the "failed" count and add manual `lat`/`lng` to `seed-records.json` for important misses, then re-run.

- [ ] **Step 4: Smoke check against the frontend**

Serve locally (`npx serve .`); open `index.html` (table populated, search works) and `map.html` (markers appear across India).
Expected: real data renders; failed-geocode groups appear in the map's "नक्शे पर नहीं" panel.

- [ ] **Step 5: Commit**

```bash
git add tools/seed/file-cache.mjs tools/seed/build-seed.mjs data/data.json data/meta.json data/source.xlsx
git commit -m "feat: add seed build script and publish initial dataset"
```

---

## Phase 10 — Deploy runbook + final verification

### Task 10.1: Deploy documentation

**Files:**
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: Create `docs/DEPLOY.md`**

````markdown
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
   - UPLOAD_PASS: a 20+ char random mix, e.g. `Bx9$mР...` (store in a password manager)
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

## E. Troubleshooting
- **"प्रकाशन विफल" (publish failed) on upload** = the GitHub commit step failed,
  not parse/geocode. Tail the Worker to see the real error:
  `npx wrangler tail --format pretty`.
- **`403 Resource not accessible by personal access token`** = the GITHUB_TOKEN
  lacks **Contents: Read and write** (or the fine-grained token is not granted to
  this repo). Regenerate the token with Contents:write on this repo only, then
  `npx wrangler secret put GITHUB_TOKEN` — no redeploy needed, secret is live.
- `401` (not 403) on commit = token expired/invalid. `404` masking a 403 =
  fine-grained token not authorized for the repo. Repo/branch existence is not the
  cause if the public site already loads.
- Each successful upload produces **3 commits** (one PUT per file: data.json,
  meta.json, source.xlsx) — cosmetic, by design, not a bug.
````

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add github pages + cloudflare worker deploy runbook"
```

---

### Task 10.2: Full test sweep + README

**Files:**
- Modify: `Readme.txt` → replace with `README.md`
- Create: `README.md`

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all suites PASS (shared, worker, assets). If any fail, fix before continuing.

- [ ] **Step 2: Run the worker tests explicitly from the worker dir**

Run: `cd worker; npx vitest run; cd ..`
Expected: all worker tests PASS (confirms worker deps resolve standalone).

- [ ] **Step 3: Create `README.md`**

```markdown
# Sadhumargi Vihar Directory

Public Hindi directory of sadhu/sadhvi vihar locations.

- **Table page** (`index.html`) — searchable list, Excel + PDF download.
- **Map page** (`map.html`) — OpenStreetMap plot with clustering.
- **Upload** — separate password-protected Cloudflare Worker (`worker/`) that
  parses an Excel, geocodes places, and commits the dataset to this repo.

## Develop
- `npm install` then `npm test` (Vitest).
- Build the published dataset from the seed: `npm run seed`.

## Deploy
See `docs/DEPLOY.md`.

## Design
- Spec: `docs/superpowers/specs/2026-06-02-sadhumargi-vihar-app-design.md`
- Plan: `docs/superpowers/plans/2026-06-02-sadhumargi-vihar-app.md`
- Visual system: `DESIGN-tesla.md` + Noto Sans Devanagari.
```

- [ ] **Step 4: Remove the empty placeholder**

```bash
git rm Readme.txt
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add project readme and remove placeholder"
```

---

## Spec Coverage Checklist

- §1 Summary / two pages → Phases 7 (table), 8 (map)
- §3 Real protection / Cloudflare Worker → Phases 4, 5
- §3 Geocoding via Nominatim → Phase 2, used in Phase 5 + seed
- §3 Replace-current model → Worker commits overwrite (Task 5.2)
- §3 Excel upload / PDF as download → Tasks 5.2 (upload), 7.2/9.0 (downloads)
- §3 Phones public → table/map render phones (Tasks 7.1, 8.1)
- §3 Hindi UI + Hindi search → all pages + Task 6.2
- §5 Data model → Task 0.2 + parse/normalize (Phase 1)
- §6 Canonical Excel template → Tasks 1.3 (header), 7.2/9.2 (emit)
- §7 Tesla visual system + Noto Devanagari → Tasks 6.1, 9.0
- §8 Worker auth/session/rate limit/secrets → Phase 4, Task 5.2, DEPLOY.md
- §9 Geocode failure handling / "not on map" panel → Tasks 2.1, 8.1, 8.2
- §10 Why Excel not PDF → Task 9.1 note
- §11 Error handling (bad file, parse, commit failure, empty data) → Tasks 5.2, 6.3, 7.1
- §12 Security model → Task 5.2 + DEPLOY.md
- §13 Testing → tests in every logic task
- §14 Cost $0 → all free tiers (DEPLOY.md)
- §15 Open items (pdf font, KV namespaces, wrangler layout, seed) → Tasks 9.0, 1.1, 10.1, 9.x
