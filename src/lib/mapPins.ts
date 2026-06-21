import type { Asset, Database, WorkItem } from './types';

// Where unresolved locations land — off-campus trips, campus-wide assets, and
// anything whose location text doesn't match a known room or building.
export const OFF_ZONE = 'Campus-wide & off-site';

// Resolve a free-text location ("HS Classrooms", "Elementary School · 204",
// "The Lighthouse PAC - Main", "Pine Crest School") to a building zone (room
// folder), or null when it can't be placed. Honest by design: this is a
// schematic placement, not a surveyed coordinate.
export function zoneOfLocation(db: Database, location?: string | null): string | null {
  if (!location) return null;
  const folders = [...new Set(db.rooms.map((r) => r.folder))];

  // 1. Any " · " segment that is exactly a room name → that room's building.
  const segs = location.split('·').map((s) => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const room = db.rooms.find((r) => r.name === seg);
    if (room) return room.folder;
  }
  // 2. The location text contains a building name (longest first so "High
  //    School" wins over a bare "School").
  for (const f of [...folders].sort((a, b) => b.length - a.length)) {
    if (location.includes(f)) return f;
  }
  // 3. A known room name appears as a substring of the location text.
  for (const r of db.rooms) {
    if (location.includes(r.name)) return r.folder;
  }
  return null;
}

// Open work orders (not done, not withdrawn) grouped by building zone. The OFF_ZONE
// bucket collects everything that couldn't be placed on a building.
export function openWorkByZone(db: Database): Map<string, WorkItem[]> {
  const m = new Map<string, WorkItem[]>();
  for (const w of db.workItems) {
    if (w.status === 'Done' || w.withdrawn) continue;
    const zone = zoneOfLocation(db, w.location) ?? OFF_ZONE;
    (m.get(zone) ?? m.set(zone, []).get(zone)!).push(w);
  }
  return m;
}

// Active assets grouped by building zone (same OFF_ZONE fallback).
export function assetsByZone(db: Database): Map<string, Asset[]> {
  const m = new Map<string, Asset[]>();
  for (const a of db.assets ?? []) {
    if (a.active === false) continue;
    const zone = zoneOfLocation(db, a.location) ?? OFF_ZONE;
    (m.get(zone) ?? m.set(zone, []).get(zone)!).push(a);
  }
  return m;
}

// Pin color for a work order: urgent shouts, then by where it sits in the flow.
export function workPinColor(w: WorkItem): string {
  if (w.priority === 'Urgent') return 'var(--bad)';
  if (w.status === 'New') return 'var(--gold)';
  if (w.status === 'In progress') return 'var(--green)';
  return 'var(--info)'; // Assigned / Scheduled
}
