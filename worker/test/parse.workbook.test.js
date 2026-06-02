import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/parse.js';

function buildXlsx(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

const HEADER = ['Zone','Serial','GroupType','Members','Thana','ViharRoute','Place','City','District','KM','ViharKarmi','ActivePersons','Lat','Lng'];

describe('parseWorkbook', () => {
  it('reads an xlsx ArrayBuffer into records', () => {
    const buf = buildXlsx([HEADER, [
      '01-मेवाड़ अंचल', 1, 'साधु', 'श्री क मुनि\nश्री ख मुनि', 2, '',
      'स्थान', 'उदयपुर', 'उदयपुर, राज.', 5, '', 'राम जी\n9999999999', '', '',
    ]]);
    const { records, errors } = parseWorkbook(buf);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].city).toBe('उदयपुर');
    expect(records[0].members).toHaveLength(2);
  });
});
