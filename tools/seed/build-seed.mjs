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
