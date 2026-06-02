import { describe, it, expect } from 'vitest';
import { mappable, popupHtml, failedList, esc } from './map.js';

const recs = [
  { zone: 'Z', serial: 1, groupType: 'साधु', members: ['अ', 'ब'], place: 'प',
    city: 'श', district: 'ज', km: 5, viharRoute: '', viharKarmi: [],
    activePersons: [{ name: 'ग', phone: '99' }], lat: 27.5, lng: 73.4, geocodeStatus: 'ok' },
  { zone: 'Z', serial: 2, groupType: 'साध्वी', members: ['स'], place: 'प2',
    city: 'X', district: 'Y', km: null, viharRoute: '', viharKarmi: [],
    activePersons: [], lat: null, lng: null, geocodeStatus: 'failed' },
];

describe('map helpers', () => {
  it('mappable keeps only records with coordinates', () => {
    expect(mappable(recs)).toHaveLength(1);
    expect(mappable(recs)[0].serial).toBe(1);
  });
  it('popupHtml includes head name, place, and a tel link', () => {
    const html = popupHtml(recs[0]);
    expect(html).toContain('अ');
    expect(html).toContain('प');
    expect(html).toContain('tel:99');
  });
  it('failedList returns the un-geocoded records', () => {
    const f = failedList(recs);
    expect(f).toHaveLength(1);
    expect(f[0].city).toBe('X');
  });
  it('esc neutralizes html and quotes', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('a"b')).toBe('a&quot;b');
  });
});
