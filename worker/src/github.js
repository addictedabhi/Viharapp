/**
 * toBase64 — encodes a UTF-8 string to base64.
 * Uses TextEncoder so multi-byte characters (e.g. Devanagari) are preserved
 * correctly; btoa alone would throw on codepoints > 0x7F.
 *
 * @param {string} str - Any UTF-8 string.
 * @returns {string} Base64-encoded representation.
 */
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in Workers and Node 18+ globalThis
  return btoa(bin);
}

/**
 * getSha — fetches the existing blob SHA for a file from the GitHub Contents API.
 * Returns null when the file does not exist yet (HTTP 404).
 *
 * @private
 */
async function getSha({ repo, path, branch, token, fetchFn }) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sadhumargi-worker',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sha lookup failed: ${res.status}`);
  const json = await res.json();
  return json.sha || null;
}

/**
 * commitFiles — writes one or more files to a GitHub repository via the
 * Contents API (PUT /repos/{repo}/contents/{path}).
 *
 * For each file the function first GETs the current blob SHA; if the file
 * already exists the SHA is included in the PUT body so GitHub accepts the
 * update.  A 404 on the GET means the file is new and the sha field is
 * omitted.  Any PUT failure stops processing immediately and returns
 * { ok: false, error }.
 *
 * @param {Array<{path: string, contentBase64: string}>} files
 *   Files to commit. `contentBase64` must be produced by {@link toBase64}.
 * @param {{ token: string, repo: string, branch: string,
 *           fetchFn: typeof fetch, message: string }} opts
 *   `token` is a fine-grained PAT with contents:write permission.
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function commitFiles(files, { token, repo, branch, fetchFn, message }) {
  try {
    for (const f of files) {
      const sha = await getSha({ repo, path: f.path, branch, token, fetchFn });
      const body = {
        message,
        content: f.contentBase64,
        branch,
        ...(sha ? { sha } : {}),
      };
      const res = await fetchFn(`https://api.github.com/repos/${repo}/contents/${f.path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'sadhumargi-worker',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).message || ''; } catch { /* ignore */ }
        return { ok: false, error: `PUT ${f.path} failed: ${res.status} ${detail}` };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
