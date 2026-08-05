import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { searchExerciseCatalogue } from './exerciseCatalogueApi';

function mockClient(result: { data: unknown[]; error: null; count?: number | null }) {
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'or', 'eq', 'order', 'range']) query[method] = vi.fn(() => query);
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
    count: 1,
  });

  const { items, total } = await searchExerciseCatalogue(client, { text: 'bench' });

  expect(items).toEqual([{
    id: '11111111-1111-4111-8111-111111111111', name: 'Bench press', category: 'chest', bodyPart: 'chest',
    equipment: 'barbell', muscleGroup: 'pectorals', secondaryMuscles: ['triceps'], target: 'pectorals',
    instructions: { en: 'Press the bar.' },
  }]);
  expect(total).toBe(1);
});

it('applies no text filter when the query text is blank', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: '  ' });
  expect(query.or).not.toHaveBeenCalled();
});

it('matches a single word across every searchable column, not just name', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: 'barbell' });
  expect(query.or).toHaveBeenCalledWith('name.ilike.%barbell%,target.ilike.%barbell%,muscle_group.ilike.%barbell%,equipment.ilike.%barbell%,category.ilike.%barbell%,body_part.ilike.%barbell%');
});

it('requires every word to match (its own column), regardless of order', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: 'press bench' });
  expect(query.or).toHaveBeenCalledTimes(2);
  expect(query.or).toHaveBeenNthCalledWith(1, expect.stringContaining('name.ilike.%press%'));
  expect(query.or).toHaveBeenNthCalledWith(2, expect.stringContaining('name.ilike.%bench%'));
});

it('strips characters that would break the PostgREST filter syntax out of a search word', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: 'bench,press(test)' });
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('name.ilike.%benchpresstest%'));
});

it('filters by body part alongside a text search when both are given', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: 'press', bodyPart: 'chest' });
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('name.ilike.%press%'));
  expect(query.eq).toHaveBeenCalledWith('body_part', 'chest');
});

it('requests the count and an id tiebreaker alongside the default page range', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: '' });
  expect(query.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' });
  expect(query.order).toHaveBeenNthCalledWith(1, 'name', { ascending: true });
  expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
  expect(query.range).toHaveBeenCalledWith(0, 29);
});

it('ranges over the requested page', async () => {
  const { client, query } = mockClient({ data: [], error: null, count: 0 });
  await searchExerciseCatalogue(client, { text: '' }, { index: 2, size: 30 });
  expect(query.range).toHaveBeenCalledWith(60, 89);
});

it('falls back to a total of 0 when the count is null', async () => {
  const { client } = mockClient({ data: [], error: null, count: null });
  const { total } = await searchExerciseCatalogue(client, { text: '' });
  expect(total).toBe(0);
});

it('throws a readable error when the catalogue query fails', async () => {
  const { client } = mockClient({ data: [], error: null });
  const failing = {
    ...client,
    from: vi.fn(() => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'range']) query[method] = vi.fn(() => query);
      query.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: { message: 'network down' } }).then(resolve);
      return query;
    }),
  } as unknown as SupabaseClient;

  await expect(searchExerciseCatalogue(failing, { text: '' })).rejects.toThrow('network down');
});
