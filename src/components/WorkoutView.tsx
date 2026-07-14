import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { executionFromPlan, todayLocalDate, type WorkoutExecutionData } from '../workout/gymSchemas';
import { completeWorkout, loadWorkout, saveWorkout, startWorkout, type WorkoutExecutionRow } from '../workout/workoutApi';
import { useAgymStore } from '../state/store';
import { RestTimer } from './RestTimer';

export function WorkoutView({ client: injectedClient }: { client?: SupabaseClient }) {
  const [execution, setExecution] = useState<WorkoutExecutionRow | null>(null);
  const [data, setData] = useState<WorkoutExecutionData | null>(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('Loading today’s workout…');
  const [noPlan, setNoPlan] = useState(false);
  const [rest, setRest] = useState(0);
  const [restNonce, setRestNonce] = useState(0);
  const date = useMemo(() => todayLocalDate(), []);
  useEffect(() => { void (async () => { try {
    const client = injectedClient ?? getSupabaseClient();
    const workout = await loadWorkout(client, date); if (!workout) { setNoPlan(true); setMessage('No structured Gym workout is scheduled for today. Ask your LLM to create one, or review Plans.'); return; }
    let current = workout.execution; if (!current) { const user = await client.auth.getUser(); if (!user.data.user) throw new Error('Sign in to start a workout.'); current = await startWorkout(client, user.data.user.id, workout.planId, workout.plan, executionFromPlan(workout.plan)); }
    setExecution(current); setData(current.execution_data); setNotes(current.additional_notes); setMessage('');
  } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not load workout.'); } })(); }, [injectedClient, date]);
  if (!data || !execution) return <section className="panel"><h2>Today’s workout</h2><p className="microcopy">{message}</p>{noPlan && <button className="ghost" onClick={() => useAgymStore.getState().setTab('plans')}>Review Plans</button>}</section>;
  const currentExecution = execution;
  const currentData = data;
  const editable = currentExecution.status === 'in_progress';
  const update = (next: WorkoutExecutionData) => { setData(next); };
  async function persistExecution() { await saveWorkout(injectedClient ?? getSupabaseClient(), currentExecution.id, currentData, notes); }
  async function persist() { try { await persistExecution(); setMessage('Progress saved.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save.'); } }
  async function finish() { try { await persistExecution(); await completeWorkout(injectedClient ?? getSupabaseClient(), currentExecution.id); setExecution({ ...currentExecution, status: 'completed', completed_at: new Date().toISOString() }); setMessage('Workout finished. Your confirmed outcome is linked to the agent plan.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not finish.'); } }
  return <section className="panel workout" aria-labelledby="workout-heading"><div className="split-head"><div><p className="eyebrow">{date}</p><h2 id="workout-heading">Today’s workout</h2><p className="microcopy">{currentExecution.planned_snapshot.title}</p></div><span className="badge">Agent proposal</span></div><p className="microcopy">Edit what actually happens. The original agent plan remains unchanged.</p>
    {data.exercises.map((exercise, exerciseIndex) => <article className="event-card" key={exercise.client_id}><div className="split-head"><h3>{exercise.name}</h3>{exercise.user_added && editable && <button className="ghost" onClick={() => update({ ...data, exercises: data.exercises.filter((_, i) => i !== exerciseIndex) })}>Remove exercise</button>}</div>
      {exercise.sets.map((set, setIndex) => <div className="workout-set" key={`${exercise.client_id}-${setIndex}`}><span>Set {setIndex + 1}</span><label>kg<input aria-label={`${exercise.name} set ${setIndex + 1} weight`} disabled={!editable} type="number" value={set.weight_kg ?? ''} onChange={(e) => { const exercises = structuredClone(data.exercises); exercises[exerciseIndex].sets[setIndex].weight_kg = e.target.value === '' ? null : Number(e.target.value); update({ ...data, exercises }); }} /></label><label>reps<input aria-label={`${exercise.name} set ${setIndex + 1} reps`} disabled={!editable} type="number" value={set.reps} onChange={(e) => { const exercises = structuredClone(data.exercises); exercises[exerciseIndex].sets[setIndex].reps = Number(e.target.value); update({ ...data, exercises }); }} /></label>{editable && <button onClick={() => { const wasCompleted = set.completed; const exercises = structuredClone(data.exercises); exercises[exerciseIndex].sets[setIndex].completed = !wasCompleted; update({ ...data, exercises }); if (!wasCompleted) { setRest(set.rest_seconds); setRestNonce((n) => n + 1); } }}>{set.completed ? 'Done' : 'Complete set'}</button>}{set.user_added && editable && <button className="ghost" onClick={() => { const exercises = structuredClone(data.exercises); exercises[exerciseIndex].sets = exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex); update({ ...data, exercises }); }}>Remove set</button>}</div>)}
      {editable && <button className="ghost" onClick={() => { const exercises = structuredClone(data.exercises); exercises[exerciseIndex].sets.push({ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, user_added: true }); update({ ...data, exercises }); }}>+ Add set</button>}</article>)}
    {editable && <button className="ghost" onClick={() => update({ ...data, exercises: [...data.exercises, { client_id: `added-${Date.now()}`, name: 'New exercise', user_added: true, sets: [{ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, user_added: true }] }] })}>+ Add exercise</button>}
    <RestTimer key={restNonce} seconds={rest} onReset={() => setRest(0)} />
    <label>Additional notes<textarea disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed, what felt notable, or anything you want preserved as self-report." /></label>
    {editable ? <div className="row"><button className="ghost" onClick={() => void persist()}>Save progress</button><button className="primary" onClick={() => void finish()}>Finish workout</button></div> : <p className="badge">Completed</p>}{message && <p role="status" className="microcopy">{message}</p>}
  </section>;
}
