import { recordToSearchText } from '../../shared/records.js';

/**
 * Trims whitespace and NFC-normalizes a search query string.
 * @param {string} q raw query
 * @returns {string}
 */
export function normalizeQuery(q) {
  return String(q || '').trim().normalize('NFC');
}

/**
 * Filters an array of canonical group records by a Hindi-aware substring query.
 * Returns all records when the query is empty.
 * @param {object[]} records array of canonical group records
 * @param {string} query raw search string
 * @returns {object[]}
 */
export function filterRecords(records, query) {
  const q = normalizeQuery(query);
  if (!q) return records.slice();
  return records.filter((r) => recordToSearchText(r).includes(q));
}
