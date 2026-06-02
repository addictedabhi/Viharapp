import { loginPage, resultPage, uploadForm } from './pages.js';
import { signSession, verifySession, checkCredentials, rateLimitHit } from './auth.js';
import { parseWorkbook as realParse } from './parse.js';
import { buildOutputs } from './normalize.js';
import { geocodeGroups as realGeocode } from './geocode.js';
import { commitFiles as realCommit, toBase64 } from './github.js';

const COOKIE = 'sess';

/**
 * Wraps a Cloudflare KV namespace ({get->string, put}) as the object cache
 * interface ({get->object|null, set}) that geocodeGroups expects.
 * @param {{get:Function, put:Function}} kv
 */
export function kvCache(kv) {
  return {
    get: async (k) => {
      const v = await kv.get(k);
      return v ? JSON.parse(v) : null;
    },
    set: async (k, v) => kv.put(k, JSON.stringify(v), { expirationTtl: 60 * 60 * 24 * 30 }),
  };
}
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
    const ok = await checkCredentials(form.get('username'), form.get('password'),
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
        fetchFn: fetch, cache: kvCache(env.GEOCODE_CACHE), userAgent: env.NOMINATIM_UA,
      });

      const isoNow = new Date(now * 1000).toISOString();
      const { dataJson, metaJson } = buildOutputs(records, { fileName: name, now: isoNow });

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
      if (!commit.ok) {
        console.error('commit failed:', commit.error);
        return html(uploadForm('प्रकाशन विफल — कृपया पुनः प्रयास करें'), 502);
      }
      return html(resultPage(metaJson));
    }
  }

  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': makeSessionCookie('', 0) } });
  }

  return html(loginPage({ error: 'पृष्ठ नहीं मिला' }), 404);
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
