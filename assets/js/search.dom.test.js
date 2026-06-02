import { describe, it, expect } from 'vitest';
import { filterRecords, normalizeQuery } from './search.js';

const recs = [
  { zone: '02-बीकानेर', members: ['श्री राजेश मुनि'], city: 'नोखागाँव', district: 'बीकानेर',
    viharKarmi: [], activePersons: [{ name: 'गंगाराम', phone: '8290821152' }] },
  { zone: '01-मेवाड़', members: ['साध्वी कमल'], city: 'उदयपुर', district: 'उदयपुर',
    viharKarmi: [], activePersons: [] },
];

describe('search', () => {
  it('normalizes query (trim + NFC)', () => {
    expect(normalizeQuery('  नोखा ')).toBe('नोखा'.normalize('NFC'));
  });
  it('returns all records for empty query', () => {
    expect(filterRecords(recs, '').length).toBe(2);
  });
  it('filters by Hindi city substring', () => {
    const out = filterRecords(recs, 'नोखा');
    expect(out).toHaveLength(1);
    expect(out[0].city).toBe('नोखागाँव');
  });
  it('filters by member name', () => {
    expect(filterRecords(recs, 'राजेश')).toHaveLength(1);
  });
  it('filters by phone number', () => {
    expect(filterRecords(recs, '8290821152')).toHaveLength(1);
  });
  it('returns empty when nothing matches', () => {
    expect(filterRecords(recs, 'कोलकाता')).toHaveLength(0);
  });
});
