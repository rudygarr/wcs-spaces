import rawEvents from '../data/events.json';
import rawPeople from '../data/people.json';
import { roomFolders, resourceFolders } from '../data/inventory';
import type { Database, EventRec, PersonRec, WcsEvent, Person } from './types';

// Builds the initial in-memory database from the harvested seed data.
// This is the demo's starting point; the store persists edits on top of it.
export function buildSeed(): Database {
  const rooms = roomFolders.flatMap((f, fi) =>
    f.items.map((name, i) => ({ id: `r-${fi}-${i}`, name, folder: f.name })),
  );
  const resources = resourceFolders.flatMap((f, fi) =>
    f.items.map((name, i) => ({ id: `res-${fi}-${i}`, name, folder: f.name })),
  );
  const people: PersonRec[] = (rawPeople as Person[]).map((p, i) => ({ ...p, id: `p-${i}` }));
  const events: EventRec[] = (rawEvents as WcsEvent[])
    .filter((e) => !!e.starts_at)
    .map((e, i) => ({ ...e, id: `e-${i}` }));
  return { rooms, resources, people, events };
}
