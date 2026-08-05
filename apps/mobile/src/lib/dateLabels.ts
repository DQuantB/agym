const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateParts(value: string): { weekday: number; day: number; month: number } {
  if (isDateOnly(value)) {
    const anchored = new Date(`${value}T12:00:00.000Z`);
    return { weekday: anchored.getUTCDay(), day: anchored.getUTCDate(), month: anchored.getUTCMonth() };
  }
  const date = new Date(value);
  return { weekday: date.getDay(), day: date.getDate(), month: date.getMonth() };
}

export function formatWeekdayDate(iso: string): string {
  const { weekday, day, month } = dateParts(iso);
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month]}`;
}

export function formatDayMonth(iso: string): string {
  const { day, month } = dateParts(iso);
  return `${day} ${MONTHS[month]}`;
}

export function formatClockTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** date-only (YYYY-MM-DD) inputs only — for full timestamps, slice to the date portion first. */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T12:00:00.000Z`).getTime();
  const to = new Date(`${toDate}T12:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** date-only (YYYY-MM-DD) inputs only. */
export function relativeDayLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} days ago`;
  return formatWeekdayDate(date);
}

/** Relative age of a timestamp, for cache-staleness lines like "Saved data · updated 2h ago". */
export function formatUpdatedAgo(isoTimestamp: string, now: Date): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return 'recently';
  const diffMs = now.getTime() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `on ${formatDayMonth(isoTimestamp)}`;
}
