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
  kind: string;
  categoryLabel: string;
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

/** Readable label for a plan's `plan_data.kind` category. Extend this map as new plan categories (run, meal, ...) ship. */
export function planCategoryLabel(kind: string): string {
  const known: Record<string, string> = { gym_workout: 'Gym' };
  return known[kind] ?? kind.replace(/_.*/, '').replace(/^\w/, (char) => char.toUpperCase());
}

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
    kind: plan.plan.kind,
    categoryLabel: planCategoryLabel(plan.plan.kind),
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

/** Identifies proposals that are the same training content repeated on different dates, so the user reviews and accepts them once instead of day by day. */
function planContentSignature(plan: GymPlan): string {
  const exercises = plan.exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets.map((set) => ({ reps: set.reps, weight_kg: set.weight_kg ?? null, rest_seconds: set.rest_seconds })),
  }));
  return JSON.stringify({ kind: plan.kind, title: plan.title, notes: plan.notes ?? null, exercises });
}

export type ProposalGroup = {
  key: string;
  entry: AgendaEntry;
  occurrences: { id: string; scheduledFor: string; whenLabel: string }[];
};

export function groupIdenticalProposals(proposals: CalendarPlan[], today: string): ProposalGroup[] {
  const groups = new Map<string, CalendarPlan[]>();
  for (const proposal of proposals) {
    const key = `${proposal.source}::${planContentSignature(proposal.plan)}`;
    const existing = groups.get(key);
    if (existing) existing.push(proposal); else groups.set(key, [proposal]);
  }
  return [...groups.entries()].map(([key, plans]) => {
    const occurrences = [...plans].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    return {
      key,
      entry: toAgendaEntry(occurrences[0], today),
      occurrences: occurrences.map((plan) => ({ id: plan.id, scheduledFor: plan.scheduledFor, whenLabel: relativeDayLabel(plan.scheduledFor, today) })),
    };
  });
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
  proposals: ProposalGroup[];
  today: AgendaEntry[];
  upcoming: AgendaEntry[];
  past: AgendaEntry[];
} {
  const proposals = groupIdenticalProposals(input.proposals, input.today);
  const scheduledEntries = input.scheduled.map((plan) => toAgendaEntry(plan, input.today, input.supersededByDate?.get(plan.scheduledFor)));
  return {
    proposals,
    today: scheduledEntries.filter((entry) => entry.bucket === 'today'),
    upcoming: scheduledEntries.filter((entry) => entry.bucket === 'upcoming').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    past: scheduledEntries.filter((entry) => entry.bucket === 'past').sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
  };
}
