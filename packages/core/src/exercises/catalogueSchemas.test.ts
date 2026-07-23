import { describe, expect, it } from 'vitest';

import { catalogueExerciseSchema, dedupeCatalogueExercises, type CatalogueExercise } from './catalogueSchemas';

function record(overrides: Partial<CatalogueExercise> = {}): CatalogueExercise {
  return {
    sourceId: '0001',
    name: 'bench press',
    category: 'chest',
    bodyPart: 'chest',
    equipment: 'barbell',
    muscleGroup: 'pectorals',
    secondaryMuscles: ['triceps'],
    target: 'pectorals',
    instructions: { en: 'Press the bar.' },
    instructionSteps: { en: ['Press the bar.'] },
    ...overrides,
  };
}

describe('catalogueExerciseSchema', () => {
  it('accepts a well-formed record', () => {
    expect(catalogueExerciseSchema.safeParse(record()).success).toBe(true);
  });

  it('rejects a non-zero-padded-4-digit sourceId', () => {
    expect(catalogueExerciseSchema.safeParse(record({ sourceId: '1' })).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(catalogueExerciseSchema.safeParse(record({ name: '   ' })).success).toBe(false);
  });

  it('rejects a record missing mandatory equipment', () => {
    const withoutEquipment: Record<string, unknown> = { ...record() };
    delete withoutEquipment.equipment;
    expect(catalogueExerciseSchema.safeParse(withoutEquipment).success).toBe(false);
  });
});

describe('dedupeCatalogueExercises', () => {
  it('keeps a single record when there is nothing to dedupe', () => {
    const result = dedupeCatalogueExercises([record()]);
    expect(result).toHaveLength(1);
  });

  it('collapses exact name/equipment/body_part/target duplicates and keeps the lowest sourceId', () => {
    const a = record({ sourceId: '0088' });
    const b = record({ sourceId: '1371' });
    const result = dedupeCatalogueExercises([b, a]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('0088');
  });

  it('does not merge records that differ only by equipment', () => {
    const barbell = record({ sourceId: '0001', equipment: 'barbell' });
    const dumbbell = record({ sourceId: '0002', equipment: 'dumbbell' });
    expect(dedupeCatalogueExercises([barbell, dumbbell])).toHaveLength(2);
  });

  it('never mutates the original array', () => {
    const input = [record({ sourceId: '0002' }), record({ sourceId: '0001' })];
    const before = input.map((r) => r.sourceId);
    dedupeCatalogueExercises(input);
    expect(input.map((r) => r.sourceId)).toEqual(before);
  });

  it('returns results sorted by sourceId', () => {
    const result = dedupeCatalogueExercises([
      record({ sourceId: '0003', name: 'a' }),
      record({ sourceId: '0001', name: 'b' }),
      record({ sourceId: '0002', name: 'c' }),
    ]);
    expect(result.map((r) => r.sourceId)).toEqual(['0001', '0002', '0003']);
  });
});
