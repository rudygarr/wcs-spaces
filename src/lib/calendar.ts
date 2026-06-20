// Academic calendar — the no-school dates the scheduler has to keep in mind.
// Booking on these days isn't blocked (the gym still gets used over break), but
// the app warns so nobody schedules a student event on a day with no students.
// Seed year runs Aug 2026 – May 2027; correct against the real WCS calendar.
import { dayKey } from './data';

export type BlackoutKind = 'holiday' | 'break' | 'workday';

export interface Blackout {
  start: string; // YYYY-MM-DD (inclusive)
  end?: string; // YYYY-MM-DD (inclusive); omit for a single day
  label: string;
  kind: BlackoutKind;
}

export const SCHOOL_BLACKOUTS: Blackout[] = [
  { start: '2026-09-07', label: 'Labor Day', kind: 'holiday' },
  { start: '2026-10-16', label: 'Teacher workday — no students', kind: 'workday' },
  { start: '2026-11-25', end: '2026-11-27', label: 'Thanksgiving break', kind: 'break' },
  { start: '2026-12-21', end: '2027-01-02', label: 'Winter break', kind: 'break' },
  { start: '2027-01-18', label: 'MLK Day', kind: 'holiday' },
  { start: '2027-02-15', label: "Presidents' Day", kind: 'holiday' },
  { start: '2027-03-15', end: '2027-03-19', label: 'Spring break', kind: 'break' },
  { start: '2027-04-02', label: 'Good Friday', kind: 'holiday' },
  { start: '2027-05-31', label: 'Memorial Day', kind: 'holiday' },
];

// The blackout covering this date key (YYYY-MM-DD), or null when school is open.
export function blackoutFor(key: string): Blackout | null {
  for (const b of SCHOOL_BLACKOUTS) {
    if (b.end ? key >= b.start && key <= b.end : key === b.start) return b;
  }
  return null;
}

export function blackoutForDate(d: Date): Blackout | null {
  return blackoutFor(dayKey(d));
}
