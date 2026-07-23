import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { searchExerciseCatalogue } from './exerciseCatalogueApi';

function mockClient(result: { data: unknown[]; error: null }) {
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'ilike', 'eq', 'order', 'limit']) query[method] = vi.fn(() => query);
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, query };
}

it('maps a catalogue row into the mobile shape, including source-language instructions', async () => {
  const { client } = mockClient({
    data: [{
      id: '11111111-1111-4111-8111-111111111111', name: 'Bench press', category: 'chest', body_part: 'chest',
      equipment: 'barbell', muscle_group: 'pectorals', secondary_muscles: ['triceps'], target: 'pectorals',
      instructions: { en: 'Press the bar.' },
    }],
    error: null,
  });

  const results = await searchExerciseCatalogue(client, { text: 'bench' });

  expect(results).toEqual([{
    id: '11111111-1111-4111-8111-111111111111', name: 'Bench press', category: 'chest', bodyPart: 'chest',
    equipment: 'barbell', muscleGroup: 'pectorals', secondaryMuscles: ['triceps'], target: 'pectorals',
    instructions: { en: 'Press the bar.' },
  }]);
});

it('applies a text filter only when the query text is non-blank', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: '  ' });
  expect(query.ilike).not.toHaveBeenCalled();
});

it('filters by name and body part together when both are given', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: 'press', bodyPart: 'chest' });
  expect(query.ilike).toHaveBeenCalledWith('name', '%press%');
  expect(query.eq).toHaveBeenCalledWith('body_part', 'chest');
});

it('throws a readable error when the catalogue query fails', async () => {
  const { client } = mockClient({ data: [], error: null });
  const failing = { ...client, from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), then: (resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: { message: 'network down' } }).then(resolve) })) } as unknown as SupabaseClient;

  await expect(searchExerciseCatalogue(failing, { text: '' })).rejects.toThrow('network down');
});
