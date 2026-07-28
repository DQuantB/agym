export function parseWeightInput(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function parseRepsInput(text: string, current: number): number {
  const trimmed = text.trim();
  if (trimmed === '') return current;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return current;
  return Math.max(1, Math.round(value));
}

export function adjustWeight(current: number | null, deltaKg: number): number | null {
  const next = (current ?? 0) + deltaKg;
  return Math.max(0, Math.round(next * 100) / 100);
}

export function adjustReps(current: number, delta: number): number {
  return Math.max(1, current + delta);
}

export function formatWeightValue(value: number | null): string {
  return value === null ? '' : String(value);
}
