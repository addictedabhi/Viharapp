import { describe, it, expect } from 'vitest';
import { recordsToAoa } from './download.js';

describe('recordsToAoa', () => {
  it('produces a header row matching the canonical template', () => {
    const aoa = recordsToAoa([]);
    expect(aoa[0]).toEqual(['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng']);
  });

  it('serializes a record with newline-joined members and contacts', () => {
    const aoa = recordsToAoa([{
      zone: 'Z', serial: 1, groupType: 'साधु', members: ['अ', 'ब'], thana: 2,
      viharRoute: '', place: 'प', city: 'श', district: 'ज', km: 5,
      viharKarmi: [{ name: 'क', phone: '1' }],
      activePersons: [{ name: 'ग', phone: '2' }, { name: 'घ', phone: '3' }],
      lat: 24.5, lng: 73.7,
    }]);
    const row = aoa[1];
    expect(row[3]).toBe('अ\nब');
    expect(row[10]).toBe('क\n1');
    expect(row[11]).toBe('ग\n2\nघ\n3');
    expect(row[12]).toBe(24.5);
  });
});
