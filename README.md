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
