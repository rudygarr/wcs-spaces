import type { Database, CampBus, CampCabin, CabinRoom, CabinKind, EventInvite } from './types';

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

// ---- Cabins (lodging) ----
export const CABIN_KINDS: { key: CabinKind; label: string; icon: string }[] = [
  { key: 'student', label: 'Students', icon: 'ti-school' },
  { key: 'staff', label: 'Staff', icon: 'ti-id-badge' },
  { key: 'parent', label: 'Parent volunteers', icon: 'ti-users' },
  { key: 'guest', label: 'Guests', icon: 'ti-star' },
];

export function cabinsFor(db: Database, eventId: string): CampCabin[] {
  return (db.campCabins ?? [])
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function roomsOfCabin(db: Database, cabinId: string): CabinRoom[] {
  return (db.cabinRooms ?? []).filter((r) => r.cabinId === cabinId);
}

// Total beds: sum of room beds when the cabin is split into rooms, else its
// simple bed count.
export function cabinBeds(db: Database, cabin: CampCabin): number {
  const rooms = roomsOfCabin(db, cabin.id);
  if (rooms.length > 0) return rooms.reduce((n, r) => n + r.beds, 0);
  return cabin.beds ?? 0;
}

// Everyone assigned to a cabin (occupants + leaders).
export function cabinOccupants(db: Database, cabinId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.cabinId === cabinId);
}
export function roomOccupants(db: Database, cabinRoomId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.cabinRoomId === cabinRoomId);
}
export function cabinLeaders(db: Database, cabinId: string): EventInvite[] {
  return cabinOccupants(db, cabinId).filter((i) => i.cabinLeader);
}

export function cabinOfInvite(db: Database, invite: EventInvite): CampCabin | undefined {
  if (!invite.cabinId) return undefined;
  return (db.campCabins ?? []).find((c) => c.id === invite.cabinId);
}
export function roomOfInvite(db: Database, invite: EventInvite): CabinRoom | undefined {
  if (!invite.cabinRoomId) return undefined;
  return (db.cabinRooms ?? []).find((r) => r.id === invite.cabinRoomId);
}

// Camp attendees not yet given a bed (for the "assign" picker / warnings).
export function unhousedAttendees(db: Database, eventId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.eventId === eventId && !i.cabinId);
}
