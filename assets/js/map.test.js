import { describe, it, expect } from 'vitest';
import { markerColor } from './map.js';

describe('markerColor', () => {
  it('returns ochre for sadhvi', () => {
    expect(markerColor('साध्वी')).toBe('#9A6324');
  });
  it('returns maroon for sadhu (and any non-sadhvi)', () => {
    expect(markerColor('साधु')).toBe('#7B1E2B');
    expect(markerColor('')).toBe('#7B1E2B');
  });
});
