import type { Database, EventRec, GuardShift } from './types';
import { dayKey } from './data';

// "Everything is a resource with a calendar" (security-visitor-scope §29). The
// School-Open resource's calendar IS the operating-hours definition; anything
// outside it is after-hours and auto-flags "needs Security + Custodial."
const TZ = 'America/New_York';

// Operating window per weekday, in minutes since midnight. Sunday closed.
// (Sat is a light "events only" window — campus is open but not for classes.)
const SCHOOL_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null, // Sun — closed
  1: { open: 6 * 60 + 30, close: 18 * 60 }, // Mon 6:30a–6:00p
  2: { open: 6 * 60 + 30, close: 18 * 60 },
  3: { open: 6 * 60 + 30, close: 18 * 60 },
  4: { open: 6 * 60 + 30, close: 18 * 60 },
  5: { open: 6 * 60 + 30, close: 21 * 60 }, // Fri later — games/events
  6: { open: 8 * 60, close: 14 * 60 }, // Sat 8:00a–2:00p
};

export function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Weekday (0–6) for a dayKey, evaluated at noon to dodge DST edges.
function weekdayOf(key: string): number {
  return new Date(key + 'T12:00:00').getDay();
}

// Minutes since midnight in school time for an ISO timestamp.
function minutesOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

export function schoolHoursFor(key: string): { open: number; close: number } | null {
  return SCHOOL_HOURS[weekdayOf(key)] ?? null;
}

// Is the campus open at this exact moment (used for the live status banner)?
export function schoolStatusAt(now: Date): { open: boolean; window: { open: number; close: number } | null } {
  const key = dayKey(now);
  const window = schoolHoursFor(key);
  if (!window) return { open: false, window };
  const min = minutesOfDay(now.toISOString());
  return { open: min >= window.open && min < window.close, window };
}

function eventsOnDay(db: Database, key: string): EventRec[] {
  // Real bookings only — drop calendar notices and the parenthetical annotation
  // events (e.g. "(Music bleed…)") that aren't actual room reservations.
  return db.events.filter(
    (e) => e.starts_at && !e.cancelled && e.kind !== 'notice' && !e.name.trim().startsWith('(') && dayKey(new Date(e.starts_at)) === key,
  );
}

// Bookings that start before open or end after close (or fall on a closed day) —
// these need a guard + custodian on site outside normal staffing.
export function afterHoursEvents(db: Database, key: string): { ev: EventRec; reason: string }[] {
  const window = schoolHoursFor(key);
  const out: { ev: EventRec; reason: string }[] = [];
  for (const ev of eventsOnDay(db, key)) {
    if (ev.all_day) continue;
    const start = ev.starts_at ? minutesOfDay(ev.starts_at) : 0;
    const end = ev.ends_at ? minutesOfDay(ev.ends_at) : start;
    if (!window) { out.push({ ev, reason: 'Campus closed this day' }); continue; }
    if (start < window.open) out.push({ ev, reason: `Starts ${hhmm(start)} — before ${hhmm(window.open)} open` });
    else if (end > window.close) out.push({ ev, reason: `Runs to ${hhmm(end)} — past ${hhmm(window.close)} close` });
  }
  return out.sort((a, b) => (a.ev.starts_at ?? '').localeCompare(b.ev.starts_at ?? ''));
}

// The gate's "who's expected on campus today" list — bookings that pre-
// registered visitors (the heads-up that beats a cold walk-up).
export function expectedOnCampus(db: Database, key: string): EventRec[] {
  return eventsOnDay(db, key)
    .filter((e) => e.expectedVisitors && e.expectedVisitors.count > 0)
    .sort((a, b) => (a.expectedVisitors?.time ?? '').localeCompare(b.expectedVisitors?.time ?? ''));
}

export function shiftsOnDay(db: Database, key: string): GuardShift[] {
  return (db.guardShifts ?? []).filter((s) => s.date === key).sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start));
}

// Gaps in guard coverage: stretches of the operating window with no guard
// posted. Merges overlapping shifts, then walks the open→close window.
export function coverageGaps(db: Database, key: string): { start: number; end: number }[] {
  const window = schoolHoursFor(key);
  if (!window) return [];
  const spans = shiftsOnDay(db, key)
    .map((s) => ({ start: parseHHMM(s.start), end: parseHHMM(s.end) }))
    .sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let cursor = window.open;
  for (const sp of spans) {
    if (sp.start > cursor) gaps.push({ start: cursor, end: Math.min(sp.start, window.close) });
    cursor = Math.max(cursor, sp.end);
    if (cursor >= window.close) break;
  }
  if (cursor < window.close) gaps.push({ start: cursor, end: window.close });
  return gaps.filter((g) => g.end > g.start);
}
