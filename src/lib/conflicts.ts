import type { Database, EventRec, TripLeg, WorkItem } from './types';
import { findConflicts, eventsOnDay, DEMO_TODAY } from './data';

// One place every surface asks "is this in conflict?" — so the warning on the
// dashboard, the calendar, the queue, and a trip all agree. Conflicts are
// always soft (see the conflict philosophy): we flag, never block.

export const CONFLICT_COLOR = 'var(--warn)';
export const CONFLICT_ICON = 'ti-alert-triangle';

// A room conflict is the unordered pair of the two clashing events. The key is
// stable across reloads (event ids are deterministic), so a conversation thread
// and its "accepted" state can hang off it.
export function conflictKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('|');
}

// Owners worked it out — an 'accept' note was posted, so the warning clears.
export function isConflictResolved(db: Database, key: string): boolean {
  return (db.conflictNotes ?? []).some((n) => n.conflictKey === key && n.kind === 'accept');
}

export interface ConflictItem {
  id: string;
  kind: 'room' | 'trip';
  title: string; // the thing in conflict (event / trip name)
  detail: string; // what it collides with
  link: string; // route (no leading #)
}

// ---- Transportation: driver / vehicle double-bookings ----
function sameDayOtherTrips(db: Database, w: WorkItem): WorkItem[] {
  return db.workItems.filter(
    (o) => o.id !== w.id && !!o.scheduledFor && o.scheduledFor === w.scheduledFor && !!o.trip,
  );
}

export interface LegCollision {
  driverTrip: string | null; // name of the other trip sharing this driver
  busTrip: string | null; // name of the other trip sharing this bus
  has: boolean;
  resolved: boolean; // accepted here, or on the other trip — either clears it
}

export function legCollision(db: Database, w: WorkItem, leg: TripLeg): LegCollision {
  const others = sameDayOtherTrips(db, w);
  const driverTrip = leg.driver ? others.find((o) => o.trip!.legs.some((l) => l.driver === leg.driver)) ?? null : null;
  const busTrip = leg.bus ? others.find((o) => o.trip!.legs.some((l) => l.bus === leg.bus)) ?? null : null;
  // A driver on multiple legs of THIS trip is intentional, so not flagged.
  const elsewhereAccepted =
    (!!leg.driver && others.some((o) => o.trip!.legs.some((l) => l.driver === leg.driver && l.conflictOk))) ||
    (!!leg.bus && others.some((o) => o.trip!.legs.some((l) => l.bus === leg.bus && l.conflictOk)));
  return {
    driverTrip: driverTrip?.title ?? null,
    busTrip: busTrip?.title ?? null,
    has: !!(driverTrip || busTrip),
    resolved: !!leg.conflictOk || elsewhereAccepted,
  };
}

// Picker hints: is this driver / bus already on another trip the same day?
export function driverBusyElsewhere(db: Database, w: WorkItem, driver: string): string | null {
  return sameDayOtherTrips(db, w).find((o) => o.trip!.legs.some((l) => l.driver === driver))?.title ?? null;
}
export function busBusyElsewhere(db: Database, w: WorkItem, bus: string): string | null {
  return sameDayOtherTrips(db, w).find((o) => o.trip!.legs.some((l) => l.bus === bus))?.title ?? null;
}

export function tripHasActiveConflict(db: Database, w: WorkItem): boolean {
  if (!w.trip) return false;
  return w.trip.legs.some((l) => {
    const c = legCollision(db, w, l);
    return c.has && !c.resolved;
  });
}

// ---- Events: same room, overlapping time ----
export function eventInConflict(db: Database, e: EventRec): boolean {
  if (!e.starts_at || e.all_day) return false;
  const dayEvents = eventsOnDay(db.events, new Date(e.starts_at));
  return findConflicts(dayEvents).some(
    (c) => (c.a.id === e.id || c.b.id === e.id) && !isConflictResolved(db, conflictKey(c.a.id, c.b.id)),
  );
}

// ---- Directory badges: is this room / resource contested right now? ----
// A room is flagged if it has an upcoming real booking clash.
export function roomHasConflict(db: Database, roomName: string): boolean {
  const dayStart = new Date(DEMO_TODAY);
  dayStart.setHours(0, 0, 0, 0);
  return findConflicts(db.events).some(
    (c) =>
      c.room === roomName &&
      new Date(c.a.starts_at!).getTime() >= dayStart.getTime() &&
      !isConflictResolved(db, conflictKey(c.a.id, c.b.id)),
  );
}

// A resource (e.g. a bus) is flagged if it's on an unresolved double-booking.
export function resourceHasConflict(db: Database, resourceName: string): boolean {
  return db.workItems.some(
    (w) =>
      !!w.trip &&
      w.trip.legs.some((l) => l.bus === resourceName) &&
      w.trip.legs.some((l) => {
        const c = legCollision(db, w, l);
        return c.has && !c.resolved && c.busTrip !== null && l.bus === resourceName;
      }),
  );
}

// ---- Unified list for the dashboard ----
export function allConflicts(db: Database): ConflictItem[] {
  const out: ConflictItem[] = [];
  const dayStart = new Date(DEMO_TODAY);
  dayStart.setHours(0, 0, 0, 0);
  // Keep the dashboard to the actionable near term — today through next week.
  const windowEnd = dayStart.getTime() + 7 * 24 * 3600 * 1000;

  // Trip double-bookings first — these are the precise, actionable ones.
  for (const w of db.workItems) {
    if (!tripHasActiveConflict(db, w)) continue;
    let detail = 'Driver or vehicle double-booked';
    for (const l of w.trip!.legs) {
      const cc = legCollision(db, w, l);
      if (cc.has && !cc.resolved) {
        detail = cc.driverTrip ? `Driver also on ${cc.driverTrip}` : `Vehicle also on ${cc.busTrip}`;
        break;
      }
    }
    out.push({ id: 'tc-' + w.id, kind: 'trip', title: w.title, detail, link: '/work/' + w.id });
  }

  // Room overlaps in the window, each pair once.
  const seen = new Set<string>();
  for (const c of findConflicts(db.events)) {
    const t = new Date(c.a.starts_at!).getTime();
    if (t < dayStart.getTime() || t > windowEnd) continue;
    const key = conflictKey(c.a.id, c.b.id);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isConflictResolved(db, key)) continue;
    out.push({
      id: 'rc-' + key,
      kind: 'room',
      title: c.a.name,
      detail: c.buffer
        ? `${c.room} — setup/teardown overlaps "${c.b.name}"`
        : `${c.room} — overlaps "${c.b.name}"`,
      link: '/event/' + c.a.id,
    });
  }

  return out;
}
