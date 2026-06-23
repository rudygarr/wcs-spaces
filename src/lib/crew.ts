import type { Database, CrewAssignment, CrewMember, CrewPosition, CrewStatus, Blockout, EventRec } from './types';
import { dayKey } from './data';

// The Teams / crew layer (services-module-spec §1–§9). One place every surface
// asks "who's on this event, and is the team covered?" — so the event page, the
// Teams list, and My Schedule all agree. Like conflicts, a blockout is a soft
// warning, never a block.

// ---- coverage ----
// A slot counts as FILLED when its person has confirmed (accepted or self).
// 'requested' is pending; 'open' and 'declined' both leave the slot to fill.
export interface Coverage {
  slots: number; // total slots (each assignment row is one slot)
  filled: number; // accepted + self
  pending: number; // requested
  open: number; // open + declined
}

export function statusFilled(s: CrewStatus): boolean {
  return s === 'accepted' || s === 'self';
}

export function eventCrew(db: Database, eventId: string, teamId?: string): CrewAssignment[] {
  return (db.crewAssignments ?? []).filter(
    (a) => a.eventId === eventId && (teamId ? a.teamId === teamId : true),
  );
}

export function coverage(db: Database, eventId: string, teamId?: string): Coverage {
  const rows = eventCrew(db, eventId, teamId);
  const c: Coverage = { slots: rows.length, filled: 0, pending: 0, open: 0 };
  for (const a of rows) {
    if (statusFilled(a.status)) c.filled++;
    else if (a.status === 'requested') c.pending++;
    else c.open++;
  }
  return c;
}

// "5/7 filled · 1 pending · 1 open" — the stock-style coverage label.
export function coverageLabel(c: Coverage): string {
  const parts = [`${c.filled}/${c.slots} filled`];
  if (c.pending) parts.push(`${c.pending} pending`);
  if (c.open) parts.push(`${c.open} open`);
  return parts.join(' · ');
}

export function coverageTone(c: Coverage): 'ok' | 'warn' | 'open' {
  if (c.filled === c.slots && c.slots > 0) return 'ok';
  if (c.open > 0) return 'open';
  return 'warn'; // everything is at least requested, but not all confirmed
}

// Distinct teams that have crew on an event (in position-sort, then name order).
export function teamsOnEvent(db: Database, eventId: string): string[] {
  const ids = new Set(eventCrew(db, eventId).map((a) => a.teamId));
  return (db.crewTeams ?? []).filter((t) => ids.has(t.id)).map((t) => t.id);
}

// ---- qualifications ----
export function positionsOf(db: Database, teamId: string): CrewPosition[] {
  return (db.crewPositions ?? []).filter((p) => p.teamId === teamId).sort((a, b) => a.sort - b.sort);
}

export function membersOf(db: Database, teamId: string): CrewMember[] {
  return (db.crewMembers ?? []).filter((m) => m.teamId === teamId);
}

// Members qualified for a position, who aren't already on THIS event (so the
// picker never double-books one person into two slots on the same plan).
export function qualifiedFor(db: Database, eventId: string, positionId: string): CrewMember[] {
  const pos = (db.crewPositions ?? []).find((p) => p.id === positionId);
  if (!pos) return [];
  const taken = new Set(
    eventCrew(db, eventId, pos.teamId)
      .filter((a) => a.personId && a.status !== 'declined')
      .map((a) => a.personId),
  );
  return membersOf(db, pos.teamId).filter(
    (m) => m.positionIds.includes(positionId) && !taken.has(m.personId),
  );
}

// ---- blockouts (soft availability) ----
export function blockoutOn(db: Database, personId: string, key: string): Blockout | null {
  return (
    (db.blockouts ?? []).find((b) => b.personId === personId && b.start <= key && key <= b.end) ?? null
  );
}

// The blockout (if any) a person has on the day an event runs — for the soft
// "Maya blocked Aug 26 — Family travel. Request anyway?" warning.
export function blockoutForEvent(db: Database, personId: string, ev: EventRec): Blockout | null {
  if (!ev.starts_at) return null;
  return blockoutOn(db, personId, dayKey(new Date(ev.starts_at)));
}

// ---- a person's own schedule (My Schedule, musician POV) ----
export function myAssignments(db: Database, personId: string): CrewAssignment[] {
  return (db.crewAssignments ?? []).filter((a) => a.personId === personId);
}

export function pendingForPerson(db: Database, personId: string): CrewAssignment[] {
  return myAssignments(db, personId).filter((a) => a.status === 'requested');
}
