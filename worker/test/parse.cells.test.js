import { describe, it, expect } from 'vitest';
import { splitLines, parseContacts, parseNumber } from '../src/parse.js';

describe('cell splitting', () => {
  it('splits a multi-line cell into trimmed non-empty lines', () => {
    expect(splitLines('क\nख\n\n  ग ')).toEqual(['क', 'ख', 'ग']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines(null)).toEqual([]);
  });

  it('parses "name + phone" lines into contact objects', () => {
    const cell = 'गंगाराम जी लुणावत\n8290821152\nपंकज जी सुराना\n9413105130';
    expect(parseContacts(cell)).toEqual([
      { name: 'गंगाराम जी लुणावत', phone: '8290821152' },
      { name: 'पंकज जी सुराना', phone: '9413105130' },
    ]);
  });

  it('keeps a name with no following phone', () => {
    expect(parseContacts('संजय जी जैन')).toEqual([
      { name: 'संजय जी जैन', phone: '' },
    ]);
  });

  it('parses numbers and returns null for blanks/non-numeric', () => {
    expect(parseNumber('17.5')).toBe(17.5);
    expect(parseNumber('13')).toBe(13);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('—')).toBeNull();
  });
});
