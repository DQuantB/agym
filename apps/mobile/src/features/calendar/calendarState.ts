import type { CalendarPlan } from './calendarApi';

export type CalendarScreenState =
  | { kind: 'unconfigured' }
  | { kind: 'signed_out' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; proposal: CalendarPlan | null; active: CalendarPlan | null };

export function mapCalendarScreenState(input: {
  configured: boolean;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  proposal: CalendarPlan | null;
  active: CalendarPlan | null;
}): CalendarScreenState {
  if (!input.configured) return { kind: 'unconfigured' };
  if (!input.authenticated) return { kind: 'signed_out' };
  if (input.loading) return { kind: 'loading' };
  if (input.error) return { kind: 'error', message: input.error };
  return { kind: 'loaded', proposal: input.proposal, active: input.active };
}
