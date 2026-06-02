import { describe, it, expect, beforeEach } from 'vitest';
import { renderRows, populateZones } from './table.js';

const recs = [
  { zone: '02-बीकानेर', zoneOrder: 2, serial: 1, groupType: 'साधु',
    members: ['श्री राजेश मुनि', 'श्री मधुर मुनि'], thana: 8, viharRoute: '',
    place: 'सुराना भवन', city: 'नोखागाँव', district: 'बीकानेर', km: null,
    viharKarmi: [], activePersons: [{ name: 'गंगाराम', phone: '8290821152' }] },
  { zone: '01-मेवाड़', zoneOrder: 1, serial: 3, groupType: 'साध्वी',
    members: ['साध्वी कमल'], thana: 5, viharRoute: 'अ से ब', place: 'भवन',
    city: 'उदयपुर', district: 'उदयपुर', km: 12,
    viharKarmi: [], activePersons: [] },
];

beforeEach(() => { document.body.innerHTML = '<table class="data"><tbody id="rows"></tbody></table><select id="zone"></select>'; });

describe('table render', () => {
  it('renders one row per record with head member bold', () => {
    renderRows(recs, document.getElementById('rows'));
    const dataRows = document.querySelectorAll('#rows tr.data-row');
    expect(dataRows.length).toBe(2);
    expect(document.querySelector('.member-head').textContent).toContain('राजेश');
  });

  it('renders phone as a tel: link', () => {
    renderRows(recs, document.getElementById('rows'));
    const tel = document.querySelector('a[href^="tel:"]');
    expect(tel).toBeTruthy();
    expect(tel.getAttribute('href')).toBe('tel:8290821152');
  });

  it('inserts a zone header row when zone changes', () => {
    renderRows(recs, document.getElementById('rows'));
    expect(document.querySelectorAll('#rows tr.zone-head').length).toBe(2);
  });

  it('shows an empty state when no records', () => {
    renderRows([], document.getElementById('rows'));
    expect(document.querySelector('#rows .empty, #rows td').textContent).toContain('कोई');
  });

  it('populates the zone filter with unique zones', () => {
    populateZones(recs, document.getElementById('zone'));
    const opts = [...document.querySelectorAll('#zone option')].map((o) => o.textContent);
    expect(opts).toContain('सभी अंचल');
    expect(opts).toContain('02-बीकानेर');
    expect(opts).toContain('01-मेवाड़');
  });
});
