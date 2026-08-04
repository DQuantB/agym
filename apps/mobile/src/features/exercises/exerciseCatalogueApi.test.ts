import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { searchExerciseCatalogue } from './exerciseCatalogueApi';

function mockClient(result: { data: unknown[]; error: null }) {
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'or', 'eq', 'order', 'limit']) query[method] = vi.fn(() => query);
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

it('applies no text filter when the query text is blank', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: '  ' });
  expect(query.or).not.toHaveBeenCalled();
});

it('matches a single word across every searchable column, not just name', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: 'barbell' });
  expect(query.or).toHaveBeenCalledWith('name.ilike.%barbell%,target.ilike.%barbell%,muscle_group.ilike.%barbell%,equipment.ilike.%barbell%,category.ilike.%barbell%,body_part.ilike.%barbell%');
});

it('requires every word to match (its own column), regardless of order', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: 'press bench' });
  expect(query.or).toHaveBeenCalledTimes(2);
  expect(query.or).toHaveBeenNthCalledWith(1, expect.stringContaining('name.ilike.%press%'));
  expect(query.or).toHaveBeenNthCalledWith(2, expect.stringContaining('name.ilike.%bench%'));
});

it('strips characters that would break the PostgREST filter syntax out of a search word', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: 'bench,press(test)' });
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('name.ilike.%benchpresstest%'));
});

it('filters by body part alongside a text search when both are given', async () => {
  const { client, query } = mockClient({ data: [], error: null });
  await searchExerciseCatalogue(client, { text: 'press', bodyPart: 'chest' });
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('name.ilike.%press%'));
  expect(query.eq).toHaveBeenCalledWith('body_part', 'chest');
});

it('throws a readable error when the catalogue query fails', async () => {
  const { client } = mockClient({ data: [], error: null });
  const failing = { ...client, from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), then: (resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: { message: 'network down' } }).then(resolve) })) } as unknown as SupabaseClient;

  await expect(searchExerciseCatalogue(failing, { text: '' })).rejects.toThrow('network down');
});
