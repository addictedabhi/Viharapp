import { describe, it, expect } from 'vitest';
import { rateLimitHit } from '../src/auth.js';

function memKV() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => void m.set(k, v),
  };
}

describe('rateLimitHit', () => {
  it('allows up to the limit then blocks', async () => {
    const kv = memKV();
    const opts = { kv, ip: '1.2.3.4', limit: 3, windowSec: 900, now: 1000 };
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 1
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 2
    expect((await rateLimitHit(opts)).blocked).toBe(false); // 3
    expect((await rateLimitHit(opts)).blocked).toBe(true);  // 4 -> blocked
  });

  it('resets after the window expires', async () => {
    const kv = memKV();
    await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1000 });
    expect((await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1005 })).blocked).toBe(true);
    expect((await rateLimitHit({ kv, ip: 'x', limit: 1, windowSec: 10, now: 1020 })).blocked).toBe(false);
  });
});
