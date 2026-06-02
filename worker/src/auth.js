/**
 * HMAC-SHA256 stateless session tokens and constant-time credential check.
 * Uses Web Crypto (crypto.subtle) — available in Cloudflare Workers and Node 20+.
 */

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

/**
 * Signs a session token.
 * @param {string} user - Username to encode in the token.
 * @param {string} secret - HMAC signing secret (SESSION_SECRET).
 * @param {{ ttlSec: number, now: number }} opts - ttlSec: token lifetime in seconds; now: current Unix epoch seconds.
 * @returns {Promise<string>} Signed token string `payload.sig`.
 */
export async function signSession(user, secret, { ttlSec, now }) {
  const exp = Math.floor(now) + ttlSec;
  const payload = b64url(enc.encode(JSON.stringify({ user, exp })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * Verifies a session token.
 * Checks HMAC signature (timing-safe) before parsing, then checks expiry.
 * @param {string} token - Token string from signSession.
 * @param {string} secret - HMAC signing secret.
 * @param {{ now: number }} opts - now: current Unix epoch seconds.
 * @returns {Promise<{ valid: boolean, user?: string }>}
 */
export async function verifySession(token, secret, { now }) {
  if (!token) return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false };
  const [payload, sig] = parts;
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(sig, expected)) return { valid: false };
  let data;
  try { data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))); }
  catch { return { valid: false }; }
  if (typeof data.exp !== 'number' || Math.floor(now) >= data.exp) return { valid: false };
  if (typeof data.user !== 'string') return { valid: false };
  return { valid: true, user: data.user };
}

async function timingSafeEqualStrings(a, b) {
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [da, db] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(String(a))),
    crypto.subtle.sign('HMAC', key, enc.encode(String(b))),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

/**
 * Constant-time check of supplied credentials against expected values.
 * Compares fixed-length HMAC digests so neither field's length leaks.
 * @param {string} user - Supplied username.
 * @param {string} pass - Supplied password.
 * @param {{ user: string, pass: string }} expected - Reference credentials.
 * @returns {Promise<boolean>}
 */
export async function checkCredentials(user, pass, expected) {
  const [u, p] = await Promise.all([
    timingSafeEqualStrings(user || '', expected.user || ''),
    timingSafeEqualStrings(pass || '', expected.pass || ''),
  ]);
  return u && p;
}

/**
 * Records a login attempt for an IP and reports whether it exceeds the limit
 * within the rolling window. State stored in the injected KV.
 * @returns {Promise<{blocked: boolean, remaining: number}>}
 */
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
