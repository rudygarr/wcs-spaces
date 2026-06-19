import rawEvents from '../data/events.json';
import rawPeople from '../data/people.json';
import type { WcsEvent, Person } from './types';

export const events: WcsEvent[] = (rawEvents as WcsEvent[]).filter((e) => !!e.starts_at);
export const people: Person[] = rawPeople as Person[];

const TZ = 'America/New_York';

export function parse(d: string | null): Date | null {
  return d ? new Date(d) : null;
}

// YYYY-MM-DD key in school timezone, so day grouping is stable.
export function dayKey(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return p;
}

export function fmtTime(d: string | null): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(d));
}

export function fmtDateLong(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function fmtDateShort(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function startOfWeek(d: Date): Date {
  const key = dayKey(d);
  const local = new Date(key + 'T12:00:00');
  const dow = local.getDay();
  local.setDate(local.getDate() - dow);
  return local;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function eventsOnDay(d: Date): WcsEvent[] {
  const key = dayKey(d);
  return events
    .filter((e) => e.starts_at && dayKey(new Date(e.starts_at)) === key)
    .sort((a, b) => (a.all_day === b.all_day ? 0 : a.all_day ? -1 : 1) || (a.starts_at! < b.starts_at! ? -1 : 1));
}

// The seed year runs Aug 2026–May 2027. "Today" for the demo anchors to the
// first lively week of school so the hub never looks empty.
export const DEMO_TODAY = new Date('2026-08-20T16:00:00Z');

export function statusColor(status: string): string {
  if (status === 'Approved') return 'var(--ok)';
  if (status === 'Pending') return 'var(--warn)';
  if (status === 'Declined') return 'var(--bad)';
  return 'var(--text-3)';
}

export interface Conflict {
  room: string;
  a: WcsEvent;
  b: WcsEvent;
}

// Two events conflict if they share a room and their time ranges overlap.
export function findConflicts(list: WcsEvent[]): Conflict[] {
  const out: Conflict[] = [];
  const byRoom = new Map<string, WcsEvent[]>();
  for (const e of list) {
    if (e.all_day || e.status === 'Declined') continue;
    for (const r of e.rooms) {
      if (!byRoom.has(r)) byRoom.set(r, []);
      byRoom.get(r)!.push(e);
    }
  }
  for (const [room, evs] of byRoom) {
    evs.sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1));
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const aEnd = new Date(evs[i].ends_at || evs[i].starts_at!).getTime();
        const bStart = new Date(evs[j].starts_at!).getTime();
        if (bStart < aEnd) out.push({ room, a: evs[i], b: evs[j] });
        else break;
      }
    }
  }
  return out;
}

export const pendingCount = events.filter((e) => e.status === 'Pending').length;
export const approvedCount = events.filter((e) => e.status === 'Approved').length;
