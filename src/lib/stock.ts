import type { Database, Resource } from './types';
import { dayKey } from './data';

// Inventory math for countable resources. A resource is "stock-tracked" when it
// has a qty (chairs, tables, mics); services & personnel are not. Availability
// is computed per day: total owned minus what every event that day has claimed.

export function isCountable(r: Resource): boolean {
  return typeof r.qty === 'number';
}

export function resourceByName(db: Database, name: string): Resource | undefined {
  return db.resources.find((r) => r.name === name);
}

// Units of `name` claimed across all events on the given day (by dayKey).
// Only explicit resourceQty entries draw down stock.
export function committedOn(db: Database, name: string, key: string): number {
  let sum = 0;
  for (const e of db.events) {
    if (e.status === 'Declined') continue;
    if (e.released || e.cancelled) continue; // reclaimed no-show / cancelled frees its stock too
    const q = e.resourceQty?.[name];
    if (!q) continue;
    if (!e.starts_at) continue;
    if (dayKey(new Date(e.starts_at)) === key) sum += q;
  }
  return sum;
}

// Units still free that day. Returns null when the resource isn't stock-tracked.
export function availableOn(db: Database, name: string, key: string, excludeEventId?: string): number | null {
  const r = resourceByName(db, name);
  if (!r || typeof r.qty !== 'number') return null;
  let committed = committedOn(db, name, key);
  if (excludeEventId) {
    const ex = db.events.find((e) => e.id === excludeEventId)?.resourceQty?.[name];
    if (ex) committed -= ex;
  }
  return r.qty - committed;
}

export interface OverAllocation {
  name: string;
  qty: number; // total owned
  committed: number;
  over: number; // committed - qty
}

// Resources oversubscribed on a given day — committed exceeds stock.
export function overAllocationsOn(db: Database, key: string): OverAllocation[] {
  const out: OverAllocation[] = [];
  for (const r of db.resources) {
    if (typeof r.qty !== 'number') continue;
    const committed = committedOn(db, r.name, key);
    if (committed > r.qty) out.push({ name: r.name, qty: r.qty, committed, over: committed - r.qty });
  }
  return out;
}

// Convenience for today's view.
export function overAllocationsToday(db: Database, today: Date): OverAllocation[] {
  return overAllocationsOn(db, dayKey(today));
}
