import { describe, it, expect } from 'vitest';
import { GROUP_TYPES, recordToSearchText, emptyRecord } from './records.js';

describe('records helpers', () => {
  it('exposes the two group types', () => {
    expect(GROUP_TYPES).toEqual(['साधु', 'साध्वी']);
  });

  it('flattens a record into one searchable string', () => {
    const rec = {
      ...emptyRecord(),
      members: ['श्री राजेश मुनि जी म.सा.', 'श्री मधुरमुनिजी म.सा.'],
      place: 'सुराना भवन',
      city: 'नोखागाँव',
      district: 'बीकानेर, राज.',
      activePersons: [{ name: 'गंगाराम जी लुणावत', phone: '8290821152' }],
    };
    const text = recordToSearchText(rec);
    expect(text).toContain('राजेश');
    expect(text).toContain('नोखागाँव');
    expect(text).toContain('गंगाराम');
    expect(text).toContain('8290821152');
  });

  it('normalizes to NFC so equivalent Devanagari forms match', () => {
    const rec = { ...emptyRecord(), city: 'नोखागाँव' };
    const text = recordToSearchText(rec);
    expect(text).toBe(text.normalize('NFC'));
  });
});
