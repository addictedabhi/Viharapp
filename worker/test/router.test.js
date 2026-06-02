import { describe, it, expect, vi } from 'vitest';
import { handle, parseCookies, makeSessionCookie, kvCache } from '../src/index.js';

function memKV() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => void m.set(k, v) };
}
const env = {
  UPLOAD_USER: 'admin', UPLOAD_PASS: 'S3cret!', SESSION_SECRET: 'sek',
  GITHUB_TOKEN: 'T', GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'main',
  NOMINATIM_UA: 'UA', RATE_LIMIT: memKV(), GEOCODE_CACHE: memKV(),
};

describe('kvCache', () => {
  it('kvCache adapts KV (string get / put) to object get/set', async () => {
    const store = new Map();
    const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
    const c = kvCache(kv);
    await c.set('k', { lat: 1, lng: 2 });
    expect(typeof store.get('k')).toBe('string');
    expect(await c.get('k')).toEqual({ lat: 1, lng: 2 });
    expect(await c.get('missing')).toBeNull();
  });
});

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

  it('POST /upload with a valid session parses, geocodes, commits, and shows the result', async () => {
    const deps2 = {
      now: () => 1000,
      parseWorkbook: vi.fn(() => ({
        records: [{ zone: 'Z', zoneOrder: 1, serial: 1, groupType: 'साधु',
          members: ['अ'], city: 'X', district: 'Y', viharKarmi: [], activePersons: [],
          lat: 1, lng: 2, geocodeStatus: 'ok' }],
        errors: [],
      })),
      geocodeGroups: vi.fn(async (r) => r),
      commitFiles: vi.fn(async () => ({ ok: true })),
    };
    const login = await handle(new Request('https://w/login', {
      method: 'POST',
      body: new URLSearchParams({ username: 'admin', password: 'S3cret!' }),
      headers: { 'CF-Connecting-IP': '2.2.2.2' },
    }), env, deps2);
    const cookie = login.headers.get('Set-Cookie').split(';')[0];

    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([1, 2, 3])], 'test.xlsx'), 'test.xlsx');
    const res = await handle(new Request('https://w/upload', {
      method: 'POST', body: fd, headers: { Cookie: cookie },
    }), env, deps2);

    expect(res.status).toBe(200);
    expect(deps2.parseWorkbook).toHaveBeenCalled();
    expect(deps2.geocodeGroups).toHaveBeenCalled();
    expect(deps2.commitFiles).toHaveBeenCalled();
    expect(await res.text()).toContain('अपलोड सफल');
  });

  it('GET /upload with a valid session shows the upload form', async () => {
    const login = await handle(new Request('https://w/login', {
      method: 'POST',
      body: new URLSearchParams({ username: 'admin', password: 'S3cret!' }),
      headers: { 'CF-Connecting-IP': '3.3.3.3' },
    }), env, { now: () => 1000 });
    const cookie = login.headers.get('Set-Cookie').split(';')[0];
    const res = await handle(new Request('https://w/upload', { headers: { Cookie: cookie } }), env, { now: () => 1000 });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('एक्सेल अपलोड करें');
  });
});
