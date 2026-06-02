import { describe, it, expect } from 'vitest';
import { rowsToRecords } from '../src/parse.js';

const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

describe('rowsToRecords', () => {
  it('maps a clean row to a canonical record', () => {
    const rows = [HEADER, [
      '02-बीकानेर-मारवाड़-अंचल', 1, 'साधु',
      'श्री राजेश मुनि जी म.सा.\nश्री मधुरमुनिजी म.सा.', 8, '',
      'सुराना भवन', 'नोखागाँव', 'बीकानेर, राज.', '',
      'गुमान जी\n9482140921', 'गंगाराम जी लुणावत\n8290821152', '', '',
    ]];
    const { records, errors } = rowsToRecords(rows);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.zone).toBe('02-बीकानेर-मारवाड़-अंचल');
    expect(r.zoneOrder).toBe(2);
    expect(r.serial).toBe(1);
    expect(r.groupType).toBe('साधु');
    expect(r.members).toEqual(['श्री राजेश मुनि जी म.सा.', 'श्री मधुरमुनिजी म.सा.']);
    expect(r.thana).toBe(8);
    expect(r.city).toBe('नोखागाँव');
    expect(r.activePersons[0]).toEqual({ name: 'गंगाराम जी लुणावत', phone: '8290821152' });
    expect(r.lat).toBeNull();
    expect(r.geocodeStatus).toBe('failed');
  });

  it('uses provided Lat/Lng and marks status manual', () => {
    const rows = [HEADER, [
      '01-मेवाड़ अंचल', 5, 'साध्वी', 'साध्वी श्री कमल श्री जी म.सा.', 5, '',
      'भंडारी निवास', 'उदयपुर', 'उदयपुर, राज.', '', '', '', '24.5854', '73.7125',
    ]];
    const { records } = rowsToRecords(rows);
    expect(records[0].lat).toBeCloseTo(24.5854);
    expect(records[0].lng).toBeCloseTo(73.7125);
    expect(records[0].geocodeStatus).toBe('manual');
  });

  it('rejects an unrecognizable header', () => {
    const { records, errors } = rowsToRecords([['foo','bar'], ['a','b']]);
    expect(records).toEqual([]);
    expect(errors[0]).toMatch(/header/i);
  });

  it('reports a row missing required City/District but keeps parsing others', () => {
    const rows = [HEADER,
      ['01-मेवाड़ अंचल', 1, 'साधु', 'श्री क मुनि', 2, '', 'स्थान', '', '', '', '', '', '', ''],
      ['01-मेवाड़ अंचल', 2, 'साधु', 'श्री ख मुनि', 3, '', 'स्थान2', 'भीलवाड़ा', 'भीलवाड़ा, राज.', '', '', '', '', ''],
    ];
    const { records, errors } = rowsToRecords(rows);
    expect(records).toHaveLength(1);
    expect(records[0].serial).toBe(2);
    expect(errors.some((e) => /row 2/i.test(e) && /city|district/i.test(e))).toBe(true);
  });

  it('rejects a header that is too short', () => {
    const { records, errors } = rowsToRecords([['Zone','Serial'], ['x','1']]);
    expect(records).toEqual([]);
    expect(errors[0]).toMatch(/header/i);
  });

  it('warns but keeps a row with an unknown GroupType, defaulting to साधु', () => {
    const rows = [HEADER, [
      '01-मेवाड़ अंचल', 1, 'XYZ', 'श्री क मुनि', 2, '', 'स्थान', 'उदयपुर', 'उदयपुर, राज.', '', '', '', '', '',
    ]];
    const { records, errors } = rowsToRecords(rows);
    expect(records).toHaveLength(1);
    expect(records[0].groupType).toBe('साधु');
    expect(errors.some((e) => /GroupType/i.test(e))).toBe(true);
  });

  it('reports both reasons when a row lacks location and members', () => {
    const rows = [HEADER, [
      '01-मेवाड़ अंचल', 1, 'साधु', '', 2, '', 'स्थान', '', '', '', '', '', '', '',
    ]];
    const { records, errors } = rowsToRecords(rows);
    expect(records).toEqual([]);
    expect(errors[0]).toMatch(/City and District/);
    expect(errors[0]).toMatch(/no members listed/);
  });
});
