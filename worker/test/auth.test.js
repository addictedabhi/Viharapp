import { describe, it, expect } from 'vitest';
import { signSession, verifySession, checkCredentials } from '../src/auth.js';

const SECRET = 'test-secret-value-please-change';

describe('session tokens', () => {
  it('signs then verifies a valid unexpired token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token, SECRET, { now: 1030 });
    expect(res.valid).toBe(true);
    expect(res.user).toBe('admin');
  });

  it('rejects an expired token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 10, now: 1000 });
    const res = await verifySession(token, SECRET, { now: 2000 });
    expect(res.valid).toBe(false);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token + 'x', SECRET, { now: 1010 });
    expect(res.valid).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token, 'other-secret', { now: 1010 });
    expect(res.valid).toBe(false);
  });

  it('rejects a token with extra segments', async () => {
    const token = await signSession('admin', SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token + '.junk', SECRET, { now: 1010 });
    expect(res.valid).toBe(false);
  });

  it('rejects a token whose payload user is not a string', async () => {
    const token = await signSession(123, SECRET, { ttlSec: 60, now: 1000 });
    const res = await verifySession(token, SECRET, { now: 1010 });
    expect(res.valid).toBe(false);
  });
});

describe('checkCredentials (constant-time)', () => {
  it('accepts exact match', async () => {
    expect(await checkCredentials('u', 'p', { user: 'u', pass: 'p' })).toBe(true);
  });
  it('rejects wrong pass and wrong user', async () => {
    expect(await checkCredentials('u', 'x', { user: 'u', pass: 'p' })).toBe(false);
    expect(await checkCredentials('x', 'p', { user: 'u', pass: 'p' })).toBe(false);
  });
});
