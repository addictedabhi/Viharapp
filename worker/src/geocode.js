const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/**
 * Build a normalised cache key from city and district strings.
 * Trims surrounding whitespace and applies Unicode NFC normalisation so that
 * visually identical Devanagari strings always map to the same key.
 *
 * @param {{ city: string, district: string }} place
 * @returns {string} Pipe-separated, NFC-normalised key
 */
export function placeKey({ city, district }) {
  return `${(city || '').trim()}|${(district || '').trim()}`.normalize('NFC');
}

/**
 * Strips a trailing state segment (e.g. ", राज." / ", पश्चिम बंगाल") from a
 * district string so Nominatim resolves the district name itself.
 */
function cleanDistrict(d) {
  const s = String(d || '').trim();
  const stripped = s.replace(/,\s*[^,]*$/, '').trim();
  return stripped || s;
}

/**
 * Builds ordered Nominatim query strings for a record, from most to least specific.
 * @param {{city?:string, district?:string}} rec
 * @returns {string[]}
 */
export function queriesFor(rec) {
  const city = String(rec.city || '').trim();
  const dClean = cleanDistrict(rec.district);
  const q = [];
  if (city && dClean) q.push(`${city}, ${dClean}, India`);
  if (city) q.push(`${city}, India`);
  if (dClean) q.push(`${dClean}, India`);
  return q;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(query, { fetchFn, userAgent }) {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  let res;
  try {
    res = await fetchFn(url, { headers: { 'User-Agent': userAgent, 'Accept': 'application/json' } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let arr;
  try { arr = await res.json(); } catch { return null; }
  if (!Array.isArray(arr) || !arr.length) return null;
  const lat = Number(arr[0].lat);
  const lng = Number(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Geocode an array of group records in place using the Nominatim API.
 *
 * Records with geocodeStatus === 'manual' and non-null lat/lng are skipped
 * entirely — no network call is made.  All other records are looked up via
 * Nominatim, using an injectable cache ({get, set}) to avoid redundant
 * requests for the same place.  A configurable delayMs throttle between
 * requests honours Nominatim's <= 1 req/sec policy (pass 0 in tests).
 *
 * Mutates each record, attaching updated lat, lng, and geocodeStatus
 * ('ok' | 'failed').
 *
 * @param {object[]} records           - Group records to geocode
 * @param {object}   opts
 * @param {Function} opts.fetchFn      - Fetch-compatible function (injectable for tests)
 * @param {{ get: Function, set: Function }} opts.cache  - Async key-value cache (KV in prod)
 * @param {string}   opts.userAgent    - Required by Nominatim usage policy
 * @param {number}  [opts.delayMs=1100] - Milliseconds to wait between network requests
 * @returns {Promise<object[]>} The mutated records array
 */
export async function geocodeGroups(records, { fetchFn, cache, userAgent, delayMs = 1100 }) {
  for (const rec of records) {
    if (rec.geocodeStatus === 'manual' && rec.lat != null && rec.lng != null) continue;

    const key = placeKey(rec);
    const cached = await cache.get(key);
    if (cached) {
      rec.lat = cached.lat; rec.lng = cached.lng; rec.geocodeStatus = 'ok';
      continue;
    }

    const queries = queriesFor(rec);

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
