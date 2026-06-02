import * as XLSX from 'xlsx';
import { GROUP_TYPES, emptyRecord } from '../../shared/records.js';

const PHONE_RE = /^[+()\d][\d\s().-]{6,}$/;

/**
 * Splits a multi-line cell value into trimmed, non-empty strings.
 * @param {*} cell raw cell value (string or other)
 * @returns {string[]}
 */
export function splitLines(cell) {
  if (cell == null) return [];
  return String(cell)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parses a cell containing interleaved name/phone lines into contact objects.
 * @param {*} cell raw cell value
 * @returns {{ name: string, phone: string }[]}
 */
export function parseContacts(cell) {
  const lines = splitLines(cell);
  const out = [];
  for (const line of lines) {
    const stripped = line.replace(/\s+/g, '');
    const isPhone = PHONE_RE.test(stripped);
    if (isPhone && out.length && !out[out.length - 1].phone) {
      out[out.length - 1].phone = stripped;
    } else {
      out.push({ name: line, phone: '' });
    }
  }
  return out;
}

/**
 * Converts a cell value to a finite number, or null if blank/unparseable.
 * @param {*} cell raw cell value
 * @returns {number|null}
 */
export function parseNumber(cell) {
  if (cell == null) return null;
  const s = String(cell).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const REQUIRED_HEADER = [
  'Zone','Serial','GroupType','Members','Thana','ViharRoute',
  'Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng',
];

function zoneOrder(zone) {
  const m = String(zone).match(/^\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Converts a 2-D array of xlsx rows (first row = header) into canonical group records.
 * Collects per-row errors for skipped rows; other rows continue parsing.
 * @param {Array<Array<*>>} rows first element must be the canonical header row
 * @returns {{ records: object[], errors: string[] }}
 */
export function rowsToRecords(rows) {
  const errors = [];
  if (!rows || !rows.length) return { records: [], errors: ['empty sheet'] };
  if (!Array.isArray(rows[0])) return { records: [], errors: ['header row is not an array'] };
  const header = rows[0].map((h) => String(h).trim());
  const ok = header.length >= REQUIRED_HEADER.length
    && REQUIRED_HEADER.every((c, i) => header[i] === c);
  if (!ok) {
    return { records: [], errors: [`unrecognized header: expected ${REQUIRED_HEADER.join(', ')}`] };
  }
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
    const rowNo = i + 1; // 1-based including header row
    const get = (idx) => (row[idx] == null ? '' : row[idx]);
    const rec = emptyRecord();
    rec.zone = String(get(0)).trim();
    rec.zoneOrder = zoneOrder(rec.zone);
    rec.serial = parseNumber(get(1)) ?? 0;
    const rawType = String(get(2)).trim();
    if (rawType && !GROUP_TYPES.includes(rawType)) {
      errors.push(`row ${rowNo}: unknown GroupType "${rawType}" — defaulted to साधु`);
    }
    rec.groupType = GROUP_TYPES.includes(rawType) ? rawType : 'साधु';
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
      rec.lat = lat;
      rec.lng = lng;
      rec.geocodeStatus = 'manual';
    }
    const missingLocation = !rec.city && !rec.district;
    const missingMembers = !rec.members.length;
    if (missingLocation || missingMembers) {
      const reasons = [
        missingLocation && 'missing City and District',
        missingMembers && 'no members listed',
      ].filter(Boolean).join('; ');
      errors.push(`row ${rowNo}: ${reasons} — skipped`);
      continue;
    }
    records.push(rec);
  }
  return { records, errors };
}

/**
 * Reads the first sheet of an xlsx ArrayBuffer and converts it to canonical group records.
 * @param {ArrayBuffer|Uint8Array} arrayBuffer raw xlsx file bytes
 * @returns {{ records: object[], errors: string[] }}
 */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) return { records: [], errors: ['workbook has no sheets'] };
  const ws = wb.Sheets[first];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  return rowsToRecords(rows);
}
