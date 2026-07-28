import { expect, it } from 'vitest';

import { adjustReps, adjustWeight, formatWeightValue, parseRepsInput, parseWeightInput } from './numberFieldMath';

it('parses weight input, accepting a comma decimal and rejecting negatives', () => {
  expect(parseWeightInput('82.5')).toBe(82.5);
  expect(parseWeightInput('82,5')).toBe(82.5);
  expect(parseWeightInput('')).toBeNull();
  expect(parseWeightInput('-5')).toBeNull();
  expect(parseWeightInput('abc')).toBeNull();
});

it('parses reps input, clamping to at least 1 and falling back to the current value when invalid', () => {
  expect(parseRepsInput('8', 5)).toBe(8);
  expect(parseRepsInput('0', 5)).toBe(1);
  expect(parseRepsInput('abc', 5)).toBe(5);
  expect(parseRepsInput('', 5)).toBe(5);
});

it('adjusts weight by a delta, clamping at zero and treating null as zero', () => {
  expect(adjustWeight(80, 2.5)).toBe(82.5);
  expect(adjustWeight(null, 2.5)).toBe(2.5);
  expect(adjustWeight(1, -2.5)).toBe(0);
});

it('adjusts reps by a delta, clamping at 1', () => {
  expect(adjustReps(5, 1)).toBe(6);
  expect(adjustReps(1, -1)).toBe(1);
});

it('formats a weight value, using an empty string for null', () => {
  expect(formatWeightValue(null)).toBe('');
  expect(formatWeightValue(82.5)).toBe('82.5');
});
