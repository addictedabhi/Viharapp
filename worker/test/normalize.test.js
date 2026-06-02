import { describe, it, expect } from 'vitest';
import { buildOutputs } from '../src/normalize.js';

const recs = [
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 1, groupType: 'साधु',
    members: ['अ', 'ब'], thana: 2, city: 'नोखा', district: 'बीकानेर',
    viharKarmi: [], activePersons: [], lat: 27.5, lng: 73.4, geocodeStatus: 'ok' },
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 2, groupType: 'साध्वी',
    members: ['स'], thana: 1, city: 'X', district: 'बीकानेर',
    viharKarmi: [], activePersons: [], lat: null, lng: null, geocodeStatus: 'failed' },
];

describe('buildOutputs', () => {
  it('produces dataJson sorted by zoneOrder then serial', () => {
    const { dataJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(dataJson.records.map((r) => r.serial)).toEqual([1, 2]);
  });

  it('computes totals (groups, members by type, mapped/failed)', () => {
    const { metaJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(metaJson.totals.groups).toBe(2);
    expect(metaJson.totals.members).toBe(3);
    expect(metaJson.totals.sadhu).toBe(2);
    expect(metaJson.totals.sadhvi).toBe(1);
    expect(metaJson.totals.mapped).toBe(1);
    expect(metaJson.totals.geocodeFailed).toBe(1);
    expect(metaJson.fileName).toBe('x.xlsx');
    expect(metaJson.uploadedAt).toBe('2026-06-02T00:00:00Z');
  });

  it('lists geocode failures with location for manual fixing', () => {
    const { metaJson } = buildOutputs(recs, { fileName: 'x.xlsx', now: '2026-06-02T00:00:00Z' });
    expect(metaJson.geocodeFailures).toEqual([
      { zone: '02-बीकानेर', serial: 2, city: 'X', district: 'बीकानेर' },
    ]);
  });
});
