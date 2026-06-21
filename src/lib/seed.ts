import rawEvents from '../data/events.json';
import rawPeople from '../data/people.json';
import rawPublic from '../data/public-events.json';
import rawAthletic from '../data/athletic-events.json';
import { roomFolders, resourceFolders } from '../data/inventory';
import { seedDrivers, seedWorkItems, seedTemplates, deptStaff } from '../data/fulfillment';
import { seedAssets } from '../data/assets';
import type { Database, EventRec, PersonRec, WcsEvent, Person, Notif, ConflictNote } from './types';

// Bump this whenever the seed data changes (new events, people, rooms…).
// On load, any saved DB with an older version is thrown out and rebuilt from
// the new seed, so returning visitors don't get stuck on stale demo data.
export const SEED_VERSION = 12;

// How many of each countable resource the school owns. Resources not listed
// here are services/personnel and aren't stock-tracked. (See lib/stock.)
const RESOURCE_STOCK: Record<string, number> = {
  'Chairs': 250,
  'Student Chairs': 400,
  'Table (rectangle)': 40,
  'Table (round)': 30,
  'Table (cafeteria-style)': 24,
  'Podium': 4,
  'Big Fan (Box Fan)': 8,
  'Tent': 6,
  'Choral (Rolling) Risers': 4,
  'Platforms': 12,
  'Microphone (hand-held)': 8,
  'Microphone (headset)': 6,
  'Portable Microphone/Speaker': 6,
  'Choir Mics': 16,
  'LED Screen': 2,
  'Projector Screen': 6,
  'Projector/Screen': 10,
  'TV': 15,
  'Owl Camera': 12,
  'Band Shell': 1,
};

// Two big back-to-back events on DEMO_TODAY that together oversubscribe the
// chair and round-table stock — seeds a live inventory over-allocation so the
// availability warnings have something to show.
function seedInventoryDemand(): EventRec[] {
  const base = {
    all_day: false,
    setup_starts: null,
    teardown_ends: null,
    recurrence: null,
    percent_approved: 100,
    status: 'Approved',
    source: 'internal' as const,
    kind: 'booking' as const,
  };
  return [
    {
      ...base,
      id: 'e-inv-1',
      name: 'WCS Fall Open House',
      owner: 'Sherry Medder',
      location: 'Beacon Hall',
      rooms: ['Beacon Hall'],
      resources: ['Chairs', 'Table (round)', 'Microphone (hand-held)'],
      resourceQty: { 'Chairs': 200, 'Table (round)': 30, 'Microphone (hand-held)': 2 },
      starts_at: '2026-08-20T22:00:00.000Z', // 6pm EDT
      ends_at: '2026-08-21T01:00:00.000Z',
      details: 'Campus-wide open house for prospective families.',
    },
    {
      ...base,
      id: 'e-inv-2',
      name: 'New Family Welcome Reception',
      owner: 'Lori Sakkab',
      location: 'ES Courtyard/Field',
      rooms: ['ES Courtyard/Field'],
      resources: ['Chairs', 'Table (round)'],
      resourceQty: { 'Chairs': 120, 'Table (round)': 12 },
      starts_at: '2026-08-20T15:00:00.000Z', // 11am EDT
      ends_at: '2026-08-20T17:00:00.000Z',
      details: 'Reception for newly enrolled families.',
    },
  ];
}

// Derive starter notifications from the seeded assignments, so each crew
// member already has a ringing bell when you "view as" them.
function seedNotifs(): Notif[] {
  const out: Notif[] = [];
  for (const w of seedWorkItems) {
    if (w.assignee) {
      out.push({
        id: `n-${w.id}-a`,
        to: w.assignee,
        kind: 'assigned',
        title: `New task: ${w.title}`,
        body: w.location ?? undefined,
        link: `#/work/${w.id}`,
        createdAt: w.createdAt,
      });
    }
    w.trip?.legs.forEach((l, i) => {
      if (l.driver) {
        out.push({
          id: `n-${w.id}-l${i}`,
          to: l.driver,
          kind: 'assigned',
          title: `You're driving: ${w.title}`,
          body: w.trip?.destination ?? undefined,
          link: `#/work/${w.id}`,
          createdAt: w.createdAt,
        });
      }
    });
  }
  return out;
}

// A seeded example of the conflict-as-conversation feature: two owners (Dance
// tech vs. the Spelling Bee) negotiating the Lighthouse Theater. Left OPEN so a
// demo can read the thread and resolve it live. Keyed by the sorted event-id
// pair (e-311/e-312, deterministic from events.json order) — see
// conflicts.conflictKey. If that order shifts, the thread simply won't attach.
function seedConflictNotes(): ConflictNote[] {
  const key = 'e-311|e-312';
  return [
    {
      id: 'cn-seed-1',
      conflictKey: key,
      author: 'Vicki Kaplan',
      body: 'Hi Adriana — the MS Spelling Bee is set for the Theater that morning. Any chance dance tech can start a little later?',
      at: '2026-11-05T14:10:00Z',
      kind: 'note',
    },
    {
      id: 'cn-seed-2',
      conflictKey: key,
      author: 'Adriana Marrero',
      body: 'We need the stage early for lighting, but we can hold the house until you wrap. Want to share the morning?',
      at: '2026-11-05T15:02:00Z',
      kind: 'note',
    },
  ];
}

// Builds the initial in-memory database from the harvested seed data.
// This is the demo's starting point; the store persists edits on top of it.
export function buildSeed(): Database {
  const rooms = roomFolders.flatMap((f, fi) =>
    f.items.map((name, i) => ({ id: `r-${fi}-${i}`, name, folder: f.name })),
  );
  const resources = resourceFolders.flatMap((f, fi) =>
    f.items.map((name, i) => ({
      id: `res-${fi}-${i}`,
      name,
      folder: f.name,
      ...(RESOURCE_STOCK[name] !== undefined ? { qty: RESOURCE_STOCK[name] } : {}),
    })),
  );
  const people: PersonRec[] = (rawPeople as Person[]).map((p, i) => ({
    ...p,
    id: `p-${i}`,
    ...(deptStaff[p.name] ?? {}),
  }));
  // Internal bookings harvested from Planning Center, plus the public master
  // calendar pulled from the school's iCal feed.
  const internal: EventRec[] = (rawEvents as WcsEvent[])
    .filter((e) => !!e.starts_at)
    .map((e, i) => ({ source: 'internal', ...e, id: `e-${i}` }));
  const publicEvents: EventRec[] = (rawPublic as WcsEvent[]).map((e, i) => ({ ...e, id: `pub-${i}` }));
  // Athletics calendar — separate iCal feed (games, tournaments, dept events).
  const athletic: EventRec[] = (rawAthletic as WcsEvent[]).map((e, i) => ({ ...e, id: `ath-${i}` }));
  return {
    rooms,
    resources,
    people,
    events: [...internal, ...publicEvents, ...athletic, ...notices, ...seedInventoryDemand()],
    workItems: seedWorkItems,
    drivers: seedDrivers,
    templates: seedTemplates,
    notifications: seedNotifs(),
    conflictNotes: seedConflictNotes(),
    assets: seedAssets,
    seedVersion: SEED_VERSION,
  };
}

// Hand-authored examples of the "notice" model: events that reserve no campus
// space but still belong on the calendar — and can still carry assignments.
const base = {
  setup_starts: null,
  teardown_ends: null,
  recurrence: null,
  percent_approved: 100,
  status: 'Approved' as const,
};

const notices: EventRec[] = [
  {
    ...base,
    id: 'n-0',
    name: 'GR8 Escape — 8th Grade Camp',
    kind: 'notice',
    audience: '8th Grade',
    all_day: true,
    starts_at: '2026-10-07T00:00:00-04:00',
    ends_at: '2026-10-09T00:00:00-04:00',
    location: 'Off campus — GR8 Escape retreat center',
    owner: 'Middle School Office',
    details: 'Annual overnight 8th-grade retreat. Nothing on campus to book — listed so the whole school knows the grade is away. Support needs are assigned below.',
    rooms: [],
    resources: ['Transportation'],
    category: 'Community',
    assignments: [
      { role: 'AV Support', person: 'Rudy Garrido', status: 'Approved' },
      { role: 'Transportation', person: 'Transportation Dept.', status: 'Approved' },
      { role: 'Lead Chaperone', person: 'Middle School Office', status: 'Approved' },
    ],
  },
  {
    ...base,
    id: 'n-1',
    name: 'All-School Convocation',
    kind: 'booking',
    audience: 'All School',
    all_day: false,
    starts_at: '2026-08-20T08:30:00-04:00',
    ends_at: '2026-08-20T09:30:00-04:00',
    location: 'The Lighthouse PAC - Main',
    owner: 'Spiritual Life',
    details: 'Opening convocation for the school year.',
    rooms: ['The Lighthouse PAC - Main'],
    resources: ['Sound', 'Lighting'],
    category: 'Community',
    setupStyle: 'theater',
    assignments: [{ role: 'AV Support', person: 'Rudy Garrido', status: 'Approved' }],
  },
  {
    ...base,
    id: 'n-4',
    name: 'Varsity Soccer — Senior Night Team Meal',
    kind: 'booking',
    audience: 'Soccer - Boys - Varsity',
    all_day: false,
    starts_at: '2026-08-21T18:00:00-04:00',
    ends_at: '2026-08-21T20:00:00-04:00',
    location: 'Beacon Hall',
    owner: 'Athletics',
    details: 'Pre-season team dinner. 6 banquet rounds, seating ~48. Boosters cater.',
    rooms: ['Beacon Hall'],
    resources: ['Table (round)', 'Chairs'],
    category: 'Athletics',
    setupStyle: 'banquet',
    assignments: [
      { role: 'Setup crew', person: 'Maintenance', status: 'Approved' },
      { role: 'Catering', person: 'Booster Club', status: 'Approved' },
    ],
  },
  {
    ...base,
    id: 'n-2',
    name: 'No School — Teacher Workday',
    kind: 'notice',
    audience: 'All School',
    all_day: true,
    starts_at: '2026-10-12T00:00:00-04:00',
    ends_at: null,
    location: null,
    owner: "Head of School's Office",
    details: 'Campus closed to students.',
    rooms: [],
    resources: [],
    category: 'Community',
  },
  {
    ...base,
    id: 'n-3',
    name: 'Spirit Week',
    kind: 'notice',
    audience: 'All School',
    all_day: true,
    starts_at: '2026-10-19T00:00:00-04:00',
    ends_at: '2026-10-23T00:00:00-04:00',
    location: null,
    owner: 'Student Life',
    details: 'Themed dress-up days all week leading into Homecoming.',
    rooms: [],
    resources: [],
    category: 'Community',
  },
];
