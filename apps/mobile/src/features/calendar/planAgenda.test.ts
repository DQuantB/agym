import { expect, it } from 'vitest';

import { buildPlanAgenda, countPlanSets, planExerciseSummary, toAgendaEntry } from './planAgenda';
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
  expect(agenda.proposals.map((entry) => entry.id)).toEqual(['p1']);
  expect(agenda.today.map((entry) => entry.id)).toEqual(['s-today']);
  expect(agenda.upcoming.map((entry) => entry.id)).toEqual(['s-sooner', 's-later']);
  expect(agenda.past.map((entry) => entry.id)).toEqual(['s-past-recent', 's-past-old']);
});
