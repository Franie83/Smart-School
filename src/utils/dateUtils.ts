/**
 * Local-timezone date helpers.
 *
 * WHY: `new Date().toISOString().slice(0, 10)` returns a UTC calendar date.
 * In timezones ahead of UTC (Africa/Lagos = UTC+1, Asia/Tokyo = UTC+9, etc.)
 * this converts a local midnight to the previous UTC day, shifting every
 * calendar computation back by one day.
 *
 * Always use these helpers when you want a "YYYY-MM-DD" string that matches
 * the user's local clock.
 */

/**
 * Formats a Date as a local-timezone YYYY-MM-DD string.
 */
export function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Today's local-timezone date as YYYY-MM-DD.
 */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Local-timezone YYYY-MM string for a given Date (defaults to now).
 */
export function formatLocalMonth(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Monday of the given Date's week as YYYY-MM-DD (local timezone).
 */
export function mondayOfWeekLocal(d: Date = new Date()): string {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return formatLocalDate(monday);
}
