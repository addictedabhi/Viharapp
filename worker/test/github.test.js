import { describe, it, expect, vi } from 'vitest';
import { commitFiles, toBase64 } from '../src/github.js';

describe('github commit', () => {
  it('base64-encodes UTF-8 (Devanagari safe)', () => {
    const b64 = toBase64('नोखा');
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('नोखा');
  });

  it('PUTs each file with prior sha when the file exists', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sha: 'OLDSHA' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ commit: { sha: 'NEW' } }) });

    const res = await commitFiles(
      [{ path: 'data/data.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(true);
    const putBody = JSON.parse(fetchFn.mock.calls[1][1].body);
    expect(putBody.sha).toBe('OLDSHA');
    expect(putBody.branch).toBe('main');
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer T');
  });

  it('PUTs without sha when file is new (GET 404)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    const res = await commitFiles(
      [{ path: 'data/new.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(true);
    const putBody = JSON.parse(fetchFn.mock.calls[1][1].body);
    expect(putBody.sha).toBeUndefined();
  });

  it('returns ok:false with detail on PUT failure', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ message: 'bad' }) });
    const res = await commitFiles(
      [{ path: 'data/x.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/422|bad/);
  });

  it('returns ok:false when the network call throws', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network down'); });
    const res = await commitFiles(
      [{ path: 'data/x.json', contentBase64: toBase64('{}') }],
      { token: 'T', repo: 'o/r', branch: 'main', fetchFn, message: 'm' },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network down/);
  });
});
