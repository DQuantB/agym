import { plannedVolumeKg } from '@/features/workout/workoutMetrics';
import type { GymPlan } from '@/features/workout/workoutApi';
import { formatWeekdayDate, relativeDayLabel } from '@/lib/dateLabels';

import type { AcceptProposalResult, CalendarPlan, SupersededPlan } from './calendarApi';

export function countPlanSets(plan: GymPlan): number {
  return plan.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

export function planExerciseSummary(plan: GymPlan, max = 3): string {
  const names = plan.exercises.map((exercise) => exercise.name);
  if (names.length <= max) return names.join(' · ');
  return `${names.slice(0, max).join(' · ')} +${names.length - max} more`;
}

export type AgendaBucket = 'proposal' | 'today' | 'upcoming' | 'past';

export type AgendaEntry = {
  id: string;
  title: string;
  source: string;
  scheduledFor: string;
  dayChip: { weekday: string; dayOfMonth: string };
  whenLabel: string;
  exerciseCount: number;
  setCount: number;
  plannedVolumeKg: number;
  summary: string;
  bucket: AgendaBucket;
  accessibilityLabel: string;
  previousPlan?: SupersededPlan;
};

function dayChip(scheduledFor: string): { weekday: string; dayOfMonth: string } {
  const anchored = new Date(`${scheduledFor}T12:00:00.000Z`);
  return { weekday: formatWeekdayDate(scheduledFor).split(' ')[0], dayOfMonth: String(anchored.getUTCDate()) };
}

export function toAgendaEntry(plan: CalendarPlan, today: string, previousPlan?: SupersededPlan): AgendaEntry {
  const bucket: AgendaBucket = plan.status === 'proposed'
    ? 'proposal'
    : plan.scheduledFor === today ? 'today' : plan.scheduledFor > today ? 'upcoming' : 'past';
  const exerciseCount = plan.plan.exercises.length;
  const setCount = countPlanSets(plan.plan);
  const summary = planExerciseSummary(plan.plan);
  const whenLabel = relativeDayLabel(plan.scheduledFor, today);

  return {
    id: plan.id,
    title: plan.plan.title,
    source: plan.source,
    scheduledFor: plan.scheduledFor,
    dayChip: dayChip(plan.scheduledFor),
    whenLabel,
    exerciseCount,
    setCount,
    plannedVolumeKg: plannedVolumeKg(plan.plan),
    summary,
    bucket,
    accessibilityLabel: `${plan.plan.title}, ${whenLabel}, ${exerciseCount} exercises, ${setCount} sets. ${summary}.`,
    previousPlan,
  };
}

export function formatProposalBatchConfirmation(entries: Pick<AgendaEntry, 'title' | 'whenLabel'>[]): string {
  return entries.map((entry) => `• ${entry.title} — ${entry.whenLabel}`).join('\n');
}

export function summarizeBulkAcceptResults(
  results: AcceptProposalResult[],
  entries: Pick<AgendaEntry, 'id' | 'title'>[],
): { acceptedCount: number; failed: { title: string; error: string }[] } {
  const titleById = new Map(entries.map((entry) => [entry.id, entry.title]));
  const failed = results
    .filter((result) => !result.ok)
    .map((result) => ({ title: titleById.get(result.id) ?? 'Unknown plan', error: result.error ?? 'Could not accept this proposal.' }));
  return { acceptedCount: results.length - failed.length, failed };
}

export function buildPlanAgenda(input: {
  proposals: CalendarPlan[];
  scheduled: CalendarPlan[];
  today: string;
  supersededByDate?: Map<string, SupersededPlan>;
}): {
  proposals: AgendaEntry[];
  today: AgendaEntry[];
  upcoming: AgendaEntry[];
  past: AgendaEntry[];
} {
  const proposals = input.proposals.map((plan) => toAgendaEntry(plan, input.today));
  const scheduledEntries = input.scheduled.map((plan) => toAgendaEntry(plan, input.today, input.supersededByDate?.get(plan.scheduledFor)));
  return {
    proposals,
    today: scheduledEntries.filter((entry) => entry.bucket === 'today'),
    upcoming: scheduledEntries.filter((entry) => entry.bucket === 'upcoming').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    past: scheduledEntries.filter((entry) => entry.bucket === 'past').sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
  };
}
