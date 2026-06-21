import type { Database, Driver, TripLeg, WorkItem } from './types';
import { DEMO_TODAY } from './data';
import { driverBusyElsewhere } from './conflicts';

// Driver hours + fair auto-rotation. busHive-style dispatch: show each driver's
// accumulated on-duty hours so load is visible, and offer to assign the fairest
// available driver instead of always reaching for the same name. True to the
// soft philosophy — a suggestion and a visible cap, never a hard block. Dispatch
// can still accept a double-booking or an over-cap driver (the shuttle/short-
// staffed exception).

// An away-game leg with only a departure time still represents a real on-duty
// block (drive out, wait, drive back is often one driver). When we can't measure
// the span, we count this nominal block.
export const DEFAULT_BLOCK_HOURS = 3;
// A part-time school driver; past this in a week we surface a soft warning.
export const WEEKLY_SOFT_CAP = 20;

// Mon–Sun week containing `ref`.
export function weekRange(ref: Date = DEMO_TODAY): { from: Date; to: Date } {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const from = new Date(d);
  from.setDate(d.getDate() - dow);
  const to = new Date(from);
  to.setDate(from.getDate() + 7);
  return { from, to };
}

function inWeek(dateStr: string | undefined, wk: { from: Date; to: Date }): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr + 'T12:00:00').getTime();
  return t >= wk.from.getTime() && t < wk.to.getTime();
}

function toMin(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

// On-duty hours a driver picks up from one trip: the span of their earliest to
// latest timed leg in that trip (drive out → drive back). One timed leg falls
// back to a nominal block.
export function driverHoursInTrip(w: WorkItem, name: string): number {
  if (!w.trip) return 0;
  const mins = w.trip.legs
    .filter((l) => l.driver === name)
    .map((l) => toMin(l.time))
    .filter((m): m is number => m !== null);
  if (mins.length === 0) {
    // Assigned but untimed — still count one block per assignment-trip.
    return w.trip.legs.some((l) => l.driver === name) ? DEFAULT_BLOCK_HOURS : 0;
  }
  const span = (Math.max(...mins) - Math.min(...mins)) / 60;
  return span > 0 ? span : DEFAULT_BLOCK_HOURS;
}

function tripsForDriver(db: Database, name: string, wk?: { from: Date; to: Date }): WorkItem[] {
  return db.workItems.filter(
    (w) => !!w.trip && w.trip.legs.some((l) => l.driver === name) && (!wk || inWeek(w.scheduledFor, wk)),
  );
}

export interface DriverLoad {
  hours: number;
  trips: number;
  lastTrip: string | null; // ISO date of most recent assigned trip, or null
  overCap: boolean;
}

export function driverLoad(db: Database, name: string, ref: Date = DEMO_TODAY): DriverLoad {
  const wk = weekRange(ref);
  const trips = tripsForDriver(db, name, wk);
  const hours = trips.reduce((sum, w) => sum + driverHoursInTrip(w, name), 0);
  // Most recent assigned trip across all time — drives least-recently-used tiebreak.
  const all = tripsForDriver(db, name);
  const lastTrip = all.reduce<string | null>((acc, w) => {
    const d = w.scheduledFor ?? null;
    return d && (!acc || d > acc) ? d : acc;
  }, null);
  return { hours: Math.round(hours * 10) / 10, trips: trips.length, lastTrip, overCap: hours > WEEKLY_SOFT_CAP };
}

// Fair pick for a leg: among active drivers, prefer ones not already driving
// elsewhere that day, then the lightest week, then fewest trips, then least
// recently used, then alphabetical. Returns the recommended driver (or null if
// the roster is empty). Never blocks — if everyone's busy it still returns the
// fairest, leaving the soft double-booking for dispatch to accept.
export function suggestDriver(db: Database, w: WorkItem, leg: TripLeg, ref: Date = DEMO_TODAY): Driver | null {
  const active = db.drivers.filter((d) => d.active !== false);
  if (active.length === 0) return null;
  const ranked = active
    .map((d) => {
      const load = driverLoad(db, name(d), ref);
      const busy = driverBusyElsewhere(db, w, name(d)) ? 1 : 0;
      return { d, busy, load };
    })
    .sort(
      (a, b) =>
        a.busy - b.busy ||
        a.load.hours - b.load.hours ||
        a.load.trips - b.load.trips ||
        (a.load.lastTrip ?? '').localeCompare(b.load.lastTrip ?? '') ||
        name(a.d).localeCompare(name(b.d)),
    );
  // Avoid re-suggesting the driver already on this leg when a fairer option exists.
  const top = ranked[0];
  if (leg.driver && name(top.d) === leg.driver && ranked.length > 1) return ranked[1].d;
  return top.d;
}

const name = (d: Driver) => d.name;
