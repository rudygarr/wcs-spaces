import type { Database, EventRec, Program } from './types';
import { dayKey } from './data';
import { approvalSteps, derivedStatus } from './approvals';

// The "Program" container (services-module-spec §13). A thin umbrella; the real
// work is in its child sessions, each a normal event. One place to ask "what's
// in this program, and how approved is it?" so the detail page and the calendar
// tag agree.

// Every session under a program, cancelled ones included (the detail list shows
// them struck through). Sorted by start so the list reads chronologically.
export function sessionsOf(db: Database, programId: string): EventRec[] {
  return db.events
    .filter((e) => e.programId === programId)
    .sort((a, b) => new Date(a.starts_at ?? '').getTime() - new Date(b.starts_at ?? '').getTime());
}

// Just the live sessions — what the agenda grid, the date span, and the
// approval rollup are computed from (a cancelled session holds no room).
export function activeSessionsOf(db: Database, programId: string): EventRec[] {
  return sessionsOf(db, programId).filter((e) => !e.cancelled);
}

export function programOf(db: Database, e: EventRec): Program | null {
  if (!e.programId) return null;
  return (db.programs ?? []).find((p) => p.id === e.programId) ?? null;
}

// Distinct day keys a program spans (from its sessions, in order).
export function programDays(db: Database, programId: string): string[] {
  const keys = new Set<string>();
  for (const s of activeSessionsOf(db, programId)) {
    if (s.starts_at) keys.add(dayKey(new Date(s.starts_at)));
  }
  return [...keys].sort();
}

// Distinct rooms used across the program's sessions (agenda grid rows).
export function programRooms(db: Database, programId: string): string[] {
  const set = new Set<string>();
  for (const s of activeSessionsOf(db, programId)) for (const r of s.rooms) set.add(r);
  return [...set].sort();
}

export interface ProgramApproval {
  total: number; // approval steps across all sessions
  approved: number;
  percent: number; // 0–100 rolled up
  declined: number; // sessions with a declined step
  pending: number; // sessions still awaiting a decision
}

// Roll the per-session room approvals up to one program number (§13.6): submit
// once, each room owner approves their room, percent rolls across sessions.
export function programApproval(db: Database, programId: string): ProgramApproval {
  let total = 0;
  let approved = 0;
  let declined = 0;
  let pending = 0;
  for (const s of activeSessionsOf(db, programId)) {
    const steps = approvalSteps(db, s);
    total += steps.length;
    approved += steps.filter((x) => x.status === 'Approved').length;
    const ds = derivedStatus(steps, s.status);
    if (ds === 'Declined') declined++;
    else if (ds === 'Pending') pending++;
  }
  return { total, approved, declined, pending, percent: total ? Math.round((approved / total) * 100) : 0 };
}

// A session block placed on the agenda grid (one room-row, one day).
export interface AgendaBlock {
  session: EventRec;
  startMin: number; // minutes since midnight
  endMin: number;
}

export function agendaForDay(db: Database, programId: string, key: string): { room: string; blocks: AgendaBlock[] }[] {
  const rooms = programRooms(db, programId);
  const sessions = activeSessionsOf(db, programId).filter((s) => s.starts_at && dayKey(new Date(s.starts_at)) === key);
  return rooms.map((room) => ({
    room,
    blocks: sessions
      .filter((s) => s.rooms.includes(room))
      .map((s) => {
        const start = new Date(s.starts_at!);
        const end = s.ends_at ? new Date(s.ends_at) : start;
        return {
          session: s,
          startMin: start.getHours() * 60 + start.getMinutes(),
          endMin: end.getHours() * 60 + end.getMinutes(),
        };
      })
      .sort((a, b) => a.startMin - b.startMin),
  }));
}
