import { describe, it, expect, vi } from 'vitest';
import { loadData } from './data.js';

describe('loadData', () => {
  it('returns records + meta on success', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ records: [{ serial: 1 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ totals: { groups: 1 }, uploadedAt: 'x' }) });
    const { records, meta, error } = await loadData(fetchFn);
    expect(error).toBeNull();
    expect(records).toHaveLength(1);
    expect(meta.totals.groups).toBe(1);
  });

  it('returns empty + error when data.json is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const { records, error } = await loadData(fetchFn);
    expect(records).toEqual([]);
    expect(error).toBeTruthy();
  });
});
