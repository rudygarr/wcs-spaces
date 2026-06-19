import rawEvents from '../data/events.json';
import rawPeople from '../data/people.json';
import rawPublic from '../data/public-events.json';
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
  // Internal bookings harvested from Planning Center, plus the public master
  // calendar pulled from the school's iCal feed.
  const internal: EventRec[] = (rawEvents as WcsEvent[])
    .filter((e) => !!e.starts_at)
    .map((e, i) => ({ source: 'internal', ...e, id: `e-${i}` }));
  const publicEvents: EventRec[] = (rawPublic as WcsEvent[]).map((e, i) => ({ ...e, id: `pub-${i}` }));
  return { rooms, resources, people, events: [...internal, ...publicEvents] };
}
