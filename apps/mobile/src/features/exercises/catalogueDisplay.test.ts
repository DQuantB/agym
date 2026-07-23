import { describe, expect, it } from 'vitest';

import { pickInstructionText } from './catalogueDisplay';

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
