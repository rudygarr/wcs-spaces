import type { Database, CampBus, EventInvite } from './types';

// Buses chartered for a camp event (Warrior Week, GR8 Escape). Sorted by name.
export function busesFor(db: Database, eventId: string): CampBus[] {
  return (db.campBuses ?? [])
    .filter((b) => b.eventId === eventId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

// The roster of a bus = the camp invites assigned to it.
export function rosterOf(db: Database, busId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.busId === busId);
}

// Which bus a given invite is on (for "you're on Bus 1" on the camper's side).
export function busOfInvite(db: Database, invite: EventInvite): CampBus | undefined {
  if (!invite.busId) return undefined;
  return (db.campBuses ?? []).find((b) => b.id === invite.busId);
}

export function busLabel(bus: CampBus): string {
  return bus.label ? `${bus.name} · ${bus.label}` : bus.name;
}

export interface BusFill { filled: number; capacity?: number }
export function busFill(db: Database, bus: CampBus): BusFill {
  return { filled: rosterOf(db, bus.id).length, capacity: bus.capacity };
}

// Campers invited to the camp who haven't been put on a bus yet.
export function unassignedCampers(db: Database, eventId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.eventId === eventId && !i.busId);
}

// Does this event have any chartered buses (drives the camp panel visibility)?
export function isCamp(db: Database, eventId: string): boolean {
  return busesFor(db, eventId).length > 0;
}
