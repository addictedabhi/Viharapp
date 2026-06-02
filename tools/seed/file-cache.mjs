// tools/seed/file-cache.mjs — geocode cache backed by a JSON file (same get/set API as KV)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PATH = 'tools/seed/.geocode-cache.json';

export function fileCache() {
  const data = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : {};
  return {
    get: async (k) => (k in data ? data[k] : null),
    set: async (k, v) => { data[k] = v; writeFileSync(PATH, JSON.stringify(data, null, 2)); },
  };
}
