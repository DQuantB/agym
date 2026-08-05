import { describe, expect, it } from 'vitest';

import { formatCatalogueCount, pickInstructionText } from './catalogueDisplay';

describe('pickInstructionText', () => {
  it('returns the preferred language when present', () => {
    expect(pickInstructionText({ en: 'Press the bar.', it: 'Spingi la barra.' })).toBe('Press the bar.');
  });

  it('falls back to any available language when the preferred one is missing', () => {
    expect(pickInstructionText({ it: 'Spingi la barra.' })).toBe('Spingi la barra.');
  });

  it('falls back when the preferred language is present but blank', () => {
    expect(pickInstructionText({ en: '   ', it: 'Spingi la barra.' })).toBe('Spingi la barra.');
  });

  it('returns null when there is no usable text in any language', () => {
    expect(pickInstructionText({})).toBeNull();
    expect(pickInstructionText({ en: '' })).toBeNull();
  });
});

describe('formatCatalogueCount', () => {
  it('reports no matches when the total is zero', () => {
    expect(formatCatalogueCount(0, 0)).toBe('No matching exercises. You can still add one manually.');
  });

  it('shows loaded-of-total while more pages remain', () => {
    expect(formatCatalogueCount(30, 1318)).toBe('30 of 1318 exercises');
  });

  it('shows just the total once every row has loaded', () => {
    expect(formatCatalogueCount(30, 30)).toBe('30 exercises');
  });

  it('uses the singular form for a single exercise', () => {
    expect(formatCatalogueCount(1, 1)).toBe('1 exercise');
  });
});
