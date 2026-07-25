import type { TodayPlan } from './todayState';

export type HomeCalendarDay = {
  date: string;
  weekday: string;
  dayOfMonth: string;
  plan: TodayPlan | null;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatUtcDate(base);
}

export function buildHomeCalendarDays(startDate: string, numberOfDays: number, plans: TodayPlan[]): HomeCalendarDay[] {
  const plansByDate = new Map(plans.map((plan) => [plan.scheduledFor, plan]));

  return Array.from({ length: numberOfDays }, (_, offset) => {
    const date = addDays(startDate, offset);
    const utcDate = new Date(`${date}T12:00:00.000Z`);
    return {
      date,
      weekday: weekdays[utcDate.getUTCDay()],
      dayOfMonth: String(utcDate.getUTCDate()),
      plan: plansByDate.get(date) ?? null,
    };
  });
}
