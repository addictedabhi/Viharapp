import { describe, it, expect, vi } from 'vitest';
import { geocodeGroups, placeKey, queriesFor } from '../src/geocode.js';
import { kvCache } from '../src/index.js';

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
    expect(out[0].lat).toBe(1);
    expect(out[0].lng).toBe(2);
  });

  it('marks failed without fetching when city and district are both blank', async () => {
    const fetchFn = vi.fn();
    const recs = [{ city: '', district: '', lat: null, lng: null, geocodeStatus: 'failed' }];
    const out = await geocodeGroups(recs, { fetchFn, cache: memCache(), userAgent: 'UA', delayMs: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(out[0].geocodeStatus).toBe('failed');
    expect(out[0].lat).toBeNull();
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

  it('builds queries that drop the Hindi state abbreviation and add a city-only fallback', () => {
    expect(queriesFor({ city: 'नोखा', district: 'बीकानेर, राज.' })).toEqual([
      'नोखा, बीकानेर, India',
      'नोखा, India',
      'बीकानेर, India',
    ]);
  });
  it('handles a multi-word state suffix and district-only records', () => {
    expect(queriesFor({ city: '', district: 'उत्तर दिनाजपुर, पश्चिम बंगाल' })).toEqual([
      'उत्तर दिनाजपुर, India',
    ]);
  });

  it('works against a real-KV-shaped store via kvCache adapter (string get, put)', async () => {
    const store = new Map();
    const kv = {
      get: async (k) => (store.has(k) ? store.get(k) : null),   // returns STRING or null
      put: async (k, v) => void store.set(k, v),                // v is a STRING
    };
    const cache = kvCache(kv);
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => [{ lat: '26.9', lon: '75.8' }] }));
    const recs = [
      { city: 'जयपुर', district: 'जयपुर, राज.', lat: null, lng: null, geocodeStatus: 'failed' },
      { city: 'जयपुर', district: 'जयपुर, राज.', lat: null, lng: null, geocodeStatus: 'failed' },
    ];
    await geocodeGroups(recs, { fetchFn, cache, userAgent: 'UA', delayMs: 0 });
    expect(recs[0].lat).toBeCloseTo(26.9);
    expect(recs[0].geocodeStatus).toBe('ok');
    expect(recs[1].lat).toBeCloseTo(26.9);          // second resolved from KV-stored string
    expect(fetchFn).toHaveBeenCalledTimes(1);        // cache hit avoided a 2nd fetch
    expect(typeof [...store.values()][0]).toBe('string'); // stored as JSON string, KV-correct
  });

  it('treats a fetch rejection as a miss (marks failed, no throw)', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network down'); });
    const recs = [{ city: 'X', district: 'Y', lat: null, lng: null, geocodeStatus: 'failed' }];
    const out = await geocodeGroups(recs, { fetchFn, cache: { get: async () => null, set: async () => {} }, userAgent: 'UA', delayMs: 0 });
    expect(out[0].geocodeStatus).toBe('failed');
    expect(out[0].lat).toBeNull();
  });
});
