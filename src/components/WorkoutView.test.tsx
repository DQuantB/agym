import type { SupabaseClient } from '@supabase/supabase-js';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { initializeAgymStore, useAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { executionFromPlan, gymWorkoutPlanSchema, todayLocalDate, type WorkoutExecutionData } from '../workout/gymSchemas';
import { completeWorkout, loadWorkout, saveWorkout, startWorkout, type WorkoutExecutionRow } from '../workout/workoutApi';
import { WorkoutView } from './WorkoutView';

// vi.mock calls are hoisted above these imports by Vitest's transform, so
// the named imports above already resolve to the mocked functions below.
vi.mock('../workout/workoutApi', () => ({
  loadWorkout: vi.fn(),
  startWorkout: vi.fn(),
  saveWorkout: vi.fn(),
  completeWorkout: vi.fn(),
}));

const plan = gymWorkoutPlanSchema.parse({
  kind: 'gym_workout',
  schema_version: 1,
  scheduled_for: todayLocalDate(),
  title: 'Lower strength',
  exercises: [
    {
      client_id: 'squat',
      name: 'Back squat',
      sets: [
        { reps: 5, weight_kg: 60, rest_seconds: 180 },
        { reps: 5, weight_kg: 60, rest_seconds: 180 },
      ],
    },
  ],
});

function baseExecution(overrides: Partial<WorkoutExecutionRow> = {}): WorkoutExecutionRow {
  return {
    id: 'exec-1',
    plan_id: 'plan-1',
    scheduled_for: plan.scheduled_for,
    status: 'in_progress',
    planned_snapshot: plan,
    execution_data: executionFromPlan(plan),
    additional_notes: '',
    completed_at: null,
    ...overrides,
  };
}

function stubClient(): SupabaseClient {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  } as unknown as SupabaseClient;
}

async function renderReady(execution: WorkoutExecutionRow) {
  vi.mocked(loadWorkout).mockResolvedValue({ plan, planId: 'plan-1', execution });
  const utils = render(<WorkoutView client={stubClient()} />);
  await screen.findByText('Back squat');
  return utils;
}

describe('WorkoutView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeAgymStore({ adapter: createInMemoryStorageAdapter(), parser: mockParser });
  });

  it('shows an empty state with a working Plans link when nothing is scheduled', async () => {
    vi.mocked(loadWorkout).mockResolvedValue(null);
    render(<WorkoutView client={stubClient()} />);

    expect(await screen.findByText(/no structured gym workout is scheduled/i)).toBeInTheDocument();
    expect(startWorkout).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /review plans/i }));
    expect(useAgymStore.getState().ui.activeTab).toBe('plans');
  });

  it('shows an error message when loading fails', async () => {
    vi.mocked(loadWorkout).mockRejectedValue(new Error('network down'));
    render(<WorkoutView client={stubClient()} />);
    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  it('auto-starts a workout when a plan exists with no execution yet', async () => {
    vi.mocked(loadWorkout).mockResolvedValue({ plan, planId: 'plan-1', execution: null });
    vi.mocked(startWorkout).mockResolvedValue(baseExecution());

    render(<WorkoutView client={stubClient()} />);

    await waitFor(() => expect(startWorkout).toHaveBeenCalledTimes(1));
    expect(startWorkout).toHaveBeenCalledWith(expect.anything(), 'user-1', 'plan-1', plan, executionFromPlan(plan));
    expect(await screen.findByText('Lower strength')).toBeInTheDocument();
  });

  it('restores an in-progress execution without starting a new one', async () => {
    const editedData: WorkoutExecutionData = structuredClone(executionFromPlan(plan));
    editedData.exercises[0].sets[0].weight_kg = 65;
    const execution = baseExecution({ execution_data: editedData, additional_notes: 'previous notes' });

    await renderReady(execution);

    expect(screen.getByLabelText('Back squat set 1 weight')).toHaveValue(65);
    expect(screen.getByPlaceholderText(/what changed/i)).toHaveValue('previous notes');
    expect(startWorkout).not.toHaveBeenCalled();
  });

  it('renders the agent-proposal baseline with prefilled values', async () => {
    await renderReady(baseExecution());

    expect(screen.getByText('Agent proposal')).toBeInTheDocument();
    expect(screen.getByText(todayLocalDate())).toBeInTheDocument();
    expect(screen.getByLabelText('Back squat set 1 weight')).toHaveValue(60);
    expect(screen.getByLabelText('Back squat set 1 reps')).toHaveValue(5);
    expect(screen.getAllByText(/^Set \d$/)).toHaveLength(2);
  });

  it('lets the user edit reps and weight for a set', async () => {
    await renderReady(baseExecution());
    const user = userEvent.setup();

    const reps = screen.getByLabelText('Back squat set 1 reps');
    await user.clear(reps);
    await user.type(reps, '8');
    expect(reps).toHaveValue(8);

    const weight = screen.getByLabelText('Back squat set 1 weight');
    await user.clear(weight);
    expect(weight).toHaveValue(null);
  });

  it('adds a user-added set with its own remove control, leaving agent sets unremovable', async () => {
    await renderReady(baseExecution());
    const user = userEvent.setup();

    expect(screen.queryByRole('button', { name: 'Remove set' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add set' }));

    expect(screen.getAllByText(/^Set \d$/)).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Remove set' })).toHaveLength(1);
  });

  it('adds a user exercise and only lets the user remove user-added exercises', async () => {
    await renderReady(baseExecution());
    const user = userEvent.setup();

    expect(screen.queryByRole('button', { name: 'Remove exercise' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    expect(screen.getByText('New exercise')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove exercise' }));
    expect(screen.queryByText('New exercise')).not.toBeInTheDocument();
    expect(screen.getByText('Back squat')).toBeInTheDocument();
  });

  describe('rest timer integration', () => {
    // Fake timers must not be active during renderReady()'s awaited
    // findByText — Testing Library's internal polling depends on real
    // timers, so enabling fake timers first hangs the test until Vitest's
    // own (real) test timeout kills it. Enable fake timers only after the
    // initial async render/load has settled.
    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts the timer at the full planned duration for every completed set, even when rest windows repeat', async () => {
      await renderReady(baseExecution());
      vi.useFakeTimers();

      act(() => {
        screen.getAllByRole('button', { name: 'Complete set' })[0].click();
      });
      expect(screen.getByText('Rest timer: 3:00')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('Rest timer: 2:55')).toBeInTheDocument();

      act(() => {
        screen.getAllByRole('button', { name: 'Complete set' })[0].click();
      });
      expect(screen.getByText('Rest timer: 3:00')).toBeInTheDocument();
    });

    it('does not restart the timer when un-completing a set', async () => {
      await renderReady(baseExecution());
      vi.useFakeTimers();

      act(() => {
        screen.getAllByRole('button', { name: 'Complete set' })[0].click();
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('Rest timer: 2:55')).toBeInTheDocument();

      act(() => {
        screen.getByRole('button', { name: 'Done' }).click();
      });
      expect(screen.getByText('Rest timer: 2:55')).toBeInTheDocument();
    });
  });

  it('saves progress and shows a confirmation message', async () => {
    vi.mocked(saveWorkout).mockResolvedValue(undefined);
    const execution = baseExecution();
    await renderReady(execution);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save progress' }));

    await waitFor(() => expect(saveWorkout).toHaveBeenCalledWith(expect.anything(), 'exec-1', execution.execution_data, ''));
    expect(await screen.findByText('Progress saved.')).toBeInTheDocument();
  });

  it('shows an error and stays editable when saving fails', async () => {
    vi.mocked(saveWorkout).mockRejectedValue(new Error('offline'));
    await renderReady(baseExecution());
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save progress' }));

    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
  });

  it('finishes the workout by saving then completing, and disables further edits', async () => {
    vi.mocked(saveWorkout).mockResolvedValue(undefined);
    vi.mocked(completeWorkout).mockResolvedValue(undefined);
    const execution = baseExecution();
    await renderReady(execution);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));

    await waitFor(() => expect(completeWorkout).toHaveBeenCalledWith(expect.anything(), 'exec-1'));
    expect(saveWorkout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save progress' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Back squat set 1 weight')).toBeDisabled();
  });

  it('does not complete the workout when the progress save fails during finish', async () => {
    vi.mocked(saveWorkout).mockRejectedValue(new Error('offline'));
    await renderReady(baseExecution());
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));

    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(completeWorkout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
  });

  it('shows an error and remains editable when completion fails', async () => {
    vi.mocked(saveWorkout).mockResolvedValue(undefined);
    vi.mocked(completeWorkout).mockRejectedValue(new Error('rpc denied'));
    await renderReady(baseExecution());
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));

    expect(await screen.findByText('rpc denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
  });

  it('renders a completed execution as non-editable on load, preventing completing twice', async () => {
    await renderReady(baseExecution({ status: 'completed', completed_at: new Date().toISOString() }));

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Back squat set 1 weight')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Complete set' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add set' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add exercise' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
  });
});
