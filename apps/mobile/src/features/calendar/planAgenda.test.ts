import { expect, it } from 'vitest';

import { buildPlanAgenda, countPlanSets, groupIdenticalProposals, planCategoryLabel, planExerciseSummary, toAgendaEntry } from './planAgenda';
import type { CalendarPlan } from './calendarApi';
import type { GymPlan } from '@/features/workout/workoutApi';

function plan(overrides: Partial<GymPlan> = {}): GymPlan {
  return {
    kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-22', title: 'Upper strength',
    exercises: [
      { client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }, { reps: 5, weight_kg: 80, rest_seconds: 120 }] },
      { client_id: 'row', name: 'Row', sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90 }] },
    ],
    ...overrides,
  };
}

function calendarPlan(overrides: Partial<CalendarPlan> = {}): CalendarPlan {
  return { id: 'plan-1', status: 'active', source: 'hermes', createdAt: '2026-07-20T09:00:00Z', scheduledFor: '2026-07-22', plan: plan(), ...overrides };
}

it('counts total sets across every exercise in a plan', () => {
  expect(countPlanSets(plan())).toBe(3);
});

it('summarizes exercise names up to a max, then truncates with a remainder count', () => {
  expect(planExerciseSummary(plan())).toBe('Bench press · Row');
  const bigPlan = plan({ exercises: [
    { client_id: 'a', name: 'A', sets: [{ reps: 5, rest_seconds: 60 }] },
    { client_id: 'b', name: 'B', sets: [{ reps: 5, rest_seconds: 60 }] },
    { client_id: 'c', name: 'C', sets: [{ reps: 5, rest_seconds: 60 }] },
    { client_id: 'd', name: 'D', sets: [{ reps: 5, rest_seconds: 60 }] },
  ] });
  expect(planExerciseSummary(bigPlan, 3)).toBe('A · B · C +1 more');
});

it('buckets a proposal separately from its scheduled date, regardless of when it is scheduled for', () => {
  const proposal = calendarPlan({ status: 'proposed', scheduledFor: '2026-07-10' });
  expect(toAgendaEntry(proposal, '2026-07-21').bucket).toBe('proposal');
});

it('buckets an active plan into today, upcoming, or past by comparing scheduledFor to today', () => {
  expect(toAgendaEntry(calendarPlan({ scheduledFor: '2026-07-21' }), '2026-07-21').bucket).toBe('today');
  expect(toAgendaEntry(calendarPlan({ scheduledFor: '2026-07-24' }), '2026-07-21').bucket).toBe('upcoming');
  expect(toAgendaEntry(calendarPlan({ scheduledFor: '2026-07-18' }), '2026-07-21').bucket).toBe('past');
});

it('builds an agenda with proposals pinned separately, upcoming ascending, and past descending', () => {
  const agenda = buildPlanAgenda({
    proposals: [calendarPlan({ id: 'p1', status: 'proposed', scheduledFor: '2026-07-10' })],
    scheduled: [
      calendarPlan({ id: 's-today', scheduledFor: '2026-07-21' }),
      calendarPlan({ id: 's-later', scheduledFor: '2026-07-24' }),
      calendarPlan({ id: 's-sooner', scheduledFor: '2026-07-22' }),
      calendarPlan({ id: 's-past-old', scheduledFor: '2026-07-01' }),
      calendarPlan({ id: 's-past-recent', scheduledFor: '2026-07-15' }),
    ],
    today: '2026-07-21',
  });
  expect(agenda.proposals.map((group) => group.entry.id)).toEqual(['p1']);
  expect(agenda.today.map((entry) => entry.id)).toEqual(['s-today']);
  expect(agenda.upcoming.map((entry) => entry.id)).toEqual(['s-sooner', 's-later']);
  expect(agenda.past.map((entry) => entry.id)).toEqual(['s-past-recent', 's-past-old']);
});

it('groups proposals with identical content into one card, keeping distinct plans separate', () => {
  const groups = groupIdenticalProposals([
    calendarPlan({ id: 'wed', status: 'proposed', scheduledFor: '2026-07-22', createdAt: '2026-07-20T09:00:00Z' }),
    calendarPlan({ id: 'mon', status: 'proposed', scheduledFor: '2026-07-20', createdAt: '2026-07-20T09:00:01Z' }),
    calendarPlan({ id: 'fri', status: 'proposed', scheduledFor: '2026-07-24', createdAt: '2026-07-20T09:00:02Z' }),
    calendarPlan({ id: 'leg-day', status: 'proposed', scheduledFor: '2026-07-21', createdAt: '2026-07-20T09:00:03Z', plan: plan({ title: 'Leg day' }) }),
  ], '2026-07-19');

  expect(groups).toHaveLength(2);
  const repeated = groups.find((group) => group.entry.title === 'Upper strength');
  expect(repeated?.occurrences.map((occurrence) => occurrence.id)).toEqual(['mon', 'wed', 'fri']);
  expect(repeated?.entry.id).toBe('mon');
  const single = groups.find((group) => group.entry.title === 'Leg day');
  expect(single?.occurrences).toHaveLength(1);
});

it('does not group proposals from different sources or with different exercises, even if otherwise similar', () => {
  const groups = groupIdenticalProposals([
    calendarPlan({ id: 'a', status: 'proposed', scheduledFor: '2026-07-20' }),
    calendarPlan({ id: 'b', status: 'proposed', scheduledFor: '2026-07-22', source: 'other-llm' }),
    calendarPlan({ id: 'c', status: 'proposed', scheduledFor: '2026-07-24', plan: plan({ exercises: [{ client_id: 'bench', name: 'Bench press', sets: [{ reps: 8, weight_kg: 80, rest_seconds: 120 }] }] }) }),
  ], '2026-07-19');

  expect(groups).toHaveLength(3);
});

it('labels a known plan category and falls back to a title-cased prefix of the kind for unknown ones', () => {
  expect(planCategoryLabel('gym_workout')).toBe('Gym');
  expect(planCategoryLabel('run_workout')).toBe('Run');
  expect(planCategoryLabel('meal_plan')).toBe('Meal');
  expect(planCategoryLabel('sleep')).toBe('Sleep');
});
