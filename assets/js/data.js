/**
 * loadData — fetch member records and summary metadata.
 *
 * Requests data/data.json and data/meta.json in parallel (cache: 'no-cache'
 * so freshly uploaded files are always returned).  meta.json is optional;
 * if it is missing the call still succeeds with meta: null.
 *
 * @param {typeof fetch} [fetchFn=fetch] - Injectable fetch function (for testing).
 * @returns {Promise<{records: object[], meta: object|null, error: string|null}>}
 */
export async function loadData(fetchFn = fetch) {
  try {
    const [d, m] = await Promise.all([
      fetchFn('data/data.json', { cache: 'no-cache' }),
      fetchFn('data/meta.json', { cache: 'no-cache' }),
    ]);
    if (!d.ok) return { records: [], meta: null, error: `data.json: ${d.status}` };
    const dataJson = await d.json();
    const meta = m && m.ok ? await m.json() : null;
    return { records: dataJson.records || [], meta, error: null };
  } catch (e) {
    return { records: [], meta: null, error: String(e.message || e) };
  }
}
