# Maroon + Gold Identity Redesign + SEO — Design

**Date:** 2026-06-02
**Status:** Approved (ready for implementation plan)
**Topic:** Replace the bare Tesla-minimal theme with a Jain-community "Maroon + Gold"
visual identity, wire in the official Jain Prateek Chihna emblem, add a favicon, and
add baseline SEO/metadata — across the public site **and** the Worker pages.

## 1. Goal

The current UI follows `DESIGN-tesla.md` (white, single blue accent `#3E6AE1`, flat,
4px radius). With no product photography to carry it, the result reads as bare. This
redesign keeps Tesla's structural discipline (flat, 4px radius, 0.33s transitions, one
font) but swaps the palette to a warm **Maroon + Gold** identity rooted in the Jain
sadhu/sadhvi community, adds the official emblem as a brand mark, a favicon, and
search-engine metadata.

**Chosen approach: Approach 1 — token swap + light chrome.** Change CSS variables,
recolour existing chrome, add the emblem and SEO tags. **No DOM restructuring and no
changes to tested logic** (data contract, search, geocode, parse, `renderRows`).

## 2. Non-goals (explicitly out of scope)

- No layout/structural overhaul (no hero band, no card-based mobile view) — that was
  Approach 3, rejected.
- No per-place `ItemList` / `LocalBusiness` JSON-LD — heavy, and phone numbers are
  already public; richer schema would amplify scraping.
- No `keywords` meta (Google ignores it), no `llms.txt`.
- No purpose-built 1200×630 OG banner image (the emblem JPG is used as-is; a proper
  banner is a possible later follow-up).
- Worker pages get the theme but **no favicon** (cross-origin, admin-only; linking one
  would leak the unlisted Pages/Worker URL relationship unnecessarily).

## 3. Colour tokens

Defined in `assets/css/tokens.css`. The variable currently named `--blue` is renamed to
`--maroon`; all references update in lockstep.

| Token | Value | Role |
|-------|-------|------|
| `--maroon` | `#7B1E2B` | header band, primary buttons, headings, sadhu accent |
| `--maroon-dark` | `#5E121D` | primary button hover |
| `--gold` | `#C99700` | active nav, hairline rules, highlights |
| `--gold-soft` | `#E0B84C` | subtle gold (optional highlights) |
| `--cream` | `#FBF5E9` | summary strip, alternate surface |
| `--cream-band` | `#F4E7CE` | zone section header rows |
| `--ochre` | `#9A6324` | sadhvi accent (distinct from maroon) |
| `--dark` | `#171A20` | primary text (kept) |
| `--gray` | `#393C41` | body/secondary text (kept) |
| `--pewter` | `#5C5E62` | tertiary text (kept) |
| `--cloud` | `#EEEEEE` | table row hairlines (kept) |
| `--white` | `#FFFFFF` | base surface (kept) |
| `--radius` | `4px` | kept |
| `--transition` | `0.33s cubic-bezier(.5,0,0,.75)` | kept |

Removed: `--blue`. Any remaining blue (`#3E6AE1`, `#3358c4`) references are replaced.

## 4. Chrome changes (colour only — no DOM change unless noted)

All in `assets/css/app.css` unless stated.

- **Header (`header.topbar`)** → maroon band (`--maroon`), white brand text, nav links
  cream/white, active link gets a gold (`--gold`) underline. Emblem chip added (see §5).
- **Summary bar (`.summary-bar`)** → background `--cream`, text `--gray`.
- **Zone header rows (`table.data tr.zone-head td`)** → background `--cream-band`,
  text `--maroon`, thin gold bottom rule.
- **Buttons (`button`, `.btn`)** → primary: `--maroon` bg / white text; hover
  `--maroon-dark`. Secondary: white bg, `--maroon` text, `--maroon` border.
- **Type tags** → sadhu: `--maroon`; sadhvi: `--ochre`. (Replaces the old blue/red.)
- **Map legend + markers** → `.dot.sadhu` `--maroon`, `.dot.sadhvi` `--ochre`.
  Marker colours in `assets/js/map.js` updated to match (see §6).
- **Links (`a`)** → default `--pewter` (kept); hover/active lean `--maroon`.

## 5. Emblem wiring

- Source asset already provided: `assets/logo.jpg` — the official Jain Prateek Chihna
  (loka silhouette: three dots + crescent, swastika, ahimsa hand with wheel, mantra
  "परस्परोपग्रहो जीवानाम्"). It is a **white-background JPG**.
- Rendered inside a **white/cream circular chip** in the header (and the Worker login
  page), which both frames it intentionally and hides the JPG's white-rectangle edges
  against the maroon band.
- Markup: a small `<img class="brand-emblem" src="assets/logo.jpg" alt="जैन प्रतीक चिन्ह">`
  added to the header before the brand text. `onerror` hides the image and leaves the
  text wordmark — **the site never breaks if the asset is missing or fails to load.**
- The Worker pages reference the emblem inline (same chip treatment) using a path/asset
  appropriate to the Worker origin, or omit the `<img>` and keep the chip empty if no
  same-origin asset is available — login must not depend on a cross-origin image.

## 6. Map marker colours

`assets/js/map.js` currently colours markers blue (sadhu) / red (sadhvi). Update the
marker colour helper/constants to `--maroon` `#7B1E2B` (sadhu) and `--ochre` `#9A6324`
(sadhvi).
Only colour values change; clustering, `mappable`, `popupHtml`, `esc`, and
`failedList` logic are untouched. Keep popup-rendered values `esc()`-escaped.

## 7. Favicon

Generated from `assets/logo.jpg`, written to the **repo root** (served by Pages):

- `favicon.ico` (16/32/48 multi-size)
- `favicon-32.png`
- `apple-touch-icon.png` (180×180)

Linked in the `<head>` of `index.html` and `map.html`:
```html
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
```

**Generation tooling:** use ImageMagick (`magick`/`convert`) if available on the build
machine to resize/pad the emblem onto a square canvas. **Fallback if no tool is
available:** skip the generated set and link the source directly —
`<link rel="icon" href="assets/logo.jpg">` — which modern browsers accept. The emblem
is tall; pad to a square (transparent or white) before downscaling so it isn't squashed.

Worker pages: no favicon (see §2 non-goals).

## 8. SEO + metadata

Public Pages base URL is public and safe to embed: `https://addictedabhi.github.io/Sadhumargi_app/`.

### Title tags
- `index.html`: `विहार सूचना — जैन साधु-साध्वी विहार दिशा-निर्देशिका`
- `map.html`: `नक्शा — विहार सूचना | जैन साधु-साध्वी स्थान`

### Meta description (both pages, tuned per page)
> जैन साधु एवं साध्वी भगवंतों के विहार, ठाणा एवं वर्तमान स्थान की निःशुल्क दिशा-निर्देशिका। अंचलवार सूची, खोज एवं नक्शा।

### Open Graph / Twitter
- `og:site_name` = `विहार सूचना`; `og:type` = `website`; `og:locale` = `hi_IN`
- `og:title`, `og:description` (per page); `og:url` = page canonical
- `og:image` = absolute `https://addictedabhi.github.io/Sadhumargi_app/assets/logo.jpg`
- `twitter:card` = `summary`

### Standard tags
- `<link rel="canonical">` per page (absolute URL)
- `<meta name="theme-color" content="#7B1E2B">`
- `<meta name="robots" content="index,follow">`
- `lang="hi"` (already present)

### Structured data — JSON-LD (one `<script type="application/ld+json">`)
A `WebSite` node (`name`, `url`, `inLanguage: "hi"`) with a `publisher` `Organization`
(`name`, `logo` → absolute emblem URL). Accurate only — no ratings, events, or
fabricated entities.

### Site-level files (repo root)
- `robots.txt` — allow all crawlers + a `Sitemap:` line pointing to the absolute sitemap URL.
- `sitemap.xml` — three URLs: `index.html` (priority 1.0), `map.html` (priority 0.8),
  and `contact.html` (priority 0.5), each with `<lastmod>`.

## 8a. Navigation, Footer, and Contact page

### Navigation (all public pages)
The header nav gains a third link. Final order: `सूची` (index.html), `नक्शा`
(map.html), `संपर्क` (contact.html). Labels stay Hindi for consistency with the
existing nav; the active link gets the gold underline (§4). The same nav markup appears
on `index.html`, `map.html`, and `contact.html`, with the current page marked `active`.

### Footer (all public pages)
A new `<footer class="sitefoot">` added to `index.html`, `map.html`, and `contact.html`
(not the Worker pages). Three-slot flex layout:

- **Left:** `© Jain Sangh 2026` (copyright).
- **Centre:** link to `https://jainabhishek.com/` — opens in a new tab,
  `target="_blank" rel="noopener noreferrer"`. It is an external site, so the link is
  intentionally outbound (does not affect canonical/sitemap).
- **Right:** `संपर्क` — links to `contact.html`.

Styling: maroon or cream band consistent with the header treatment, gold top hairline,
`--pewter`/white text, small font (~13px), responsive (slots stack centred on mobile,
`max-width: 768px`). Exact band colour finalised against the header during
implementation so footer and header read as a pair.

> **Open item flagged by owner ambiguity:** the request placed both "contact us" and the
> copyright "on the right". Resolved here as **left = copyright, centre = website,
> right = संपर्क**, since the centre slot is the website link. Adjust if the owner
> intended otherwise.

### Contact page (`contact.html`)
A new page, **intentionally blank of content for now** (owner's instruction). It is not
an empty file — it reuses the full themed shell so it doesn't look broken:
- Same `<head>` block: favicon, theme-color, canonical (`.../contact.html`), OG/Twitter,
  title `संपर्क करें — विहार सूचना`, and a short Hindi meta description.
- Same themed header (with `संपर्क` active) and the same footer.
- Body: a single placeholder heading `संपर्क करें` and a one-line note such as
  `यह पृष्ठ शीघ्र उपलब्ध होगा।` ("this page will be available soon"). No form, no data.
- Added to `sitemap.xml` (priority 0.5) and covered by `robots.txt` allow.

## 9. Files touched

**Modify:** `assets/css/tokens.css`, `assets/css/app.css`, `index.html`, `map.html`,
`assets/js/map.js`, `worker/src/pages.js`, `worker/test/pages.test.js`.
**Create:** `contact.html`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`,
`robots.txt`, `sitemap.xml` (all at repo root).
**Already present:** `assets/logo.jpg`.

**Untouched (the spine):** `shared/records.js`, `worker/src/parse.js`,
`worker/src/normalize.js`, `worker/src/geocode.js`, `worker/src/github.js`,
`worker/src/auth.js`, `assets/js/data.js`, `assets/js/search.js`,
`assets/js/table.js` render logic, `assets/js/download.js`.

## 10. Testing

- `worker/test/pages.test.js` asserts the Tesla blue `#3E6AE1` is present in the login
  page. Update that assertion to the new `--maroon` `#7B1E2B`. Keep all other login-page
  assertions (form action, method, Hindi text) intact.
- If `map.js` exposes a tested marker-colour helper, update its expected colours; if
  marker colours are inline constants only (not unit-tested), no test change needed.
- `npm test` must stay green. No new test framework or fixtures required — this is a
  presentational change over untouched logic.
- Manual check: load `index.html`, `map.html`, and `contact.html`; confirm emblem
  renders in the chip, favicon shows in the tab, the third nav link (`संपर्क`) works and
  marks active correctly, the footer's three slots render and stack on mobile, the
  `jainabhishek.com` link opens in a new tab, and removing/renaming `logo.jpg` falls back
  to the text wordmark without breaking layout.

## 11. Risks & mitigations

- **Religious-symbol correctness:** emblem art is user-provided and authoritative; the
  app only frames it, never redraws it. The Jain swastika within the emblem carries a
  global-misread / SEO / ad-platform-flag risk — accepted by the owner.
- **White-bg JPG on maroon:** mitigated by the white/cream circular chip.
- **Missing asset:** `onerror` text fallback.
- **Favicon tooling absence:** direct-link fallback (§7).
- **Colour contrast (a11y):** maroon `#7B1E2B` on white and white on maroon both exceed
  WCAG AA; verify sadhvi `--ochre` `#9A6324` on cream tags meets AA during implementation.
