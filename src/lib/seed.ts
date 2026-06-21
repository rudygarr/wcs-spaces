import rawEvents from '../data/events.json';
import rawPeople from '../data/people.json';
import rawPublic from '../data/public-events.json';
import rawAthletic from '../data/athletic-events.json';
import { roomFolders, resourceFolders } from '../data/inventory';
import { seedDrivers, seedWorkItems, seedTemplates, deptStaff } from '../data/fulfillment';
import { seedAssets } from '../data/assets';
import type { Database, EventRec, PersonRec, WcsEvent, Person, Notif, ConflictNote, Rental, AuditEntry, RequestComment, CalendarView } from './types';

// Bump this whenever the seed data changes (new events, people, rooms…).
// On load, any saved DB with an older version is thrown out and rebuilt from
// the new seed, so returning visitors don't get stuck on stale demo data.
export const SEED_VERSION = 21;

// Max occupancy per room. Rooms not listed are uncapped / not capacity-tracked.
const ROOM_CAPACITY: Record<string, number> = {
  'Lighthouse Theater': 450,
  'The Lighthouse Studio': 60,
  'Green Room': 20,
  'White Room': 20,
  'Art Gallery': 80,
  'Theatre class room': 30,
  'Band Room': 60,
  'Beacon Hall': 300,
  'Rehearsal Studio (Orchestra Classroom)': 50,
  'B 202 Choir Classroom': 40,
  'B 201 Dance Classroom': 30,
  'TIDE Conference Room': 16,
  'MS Conference Room': 14,
  'Gym': 1200,
  'SAC': 600,
  'ES Gym': 300,
  'NC101 Classroom': 28,
  'NC102 Classroom': 28,
};

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
      checkInAt: '2026-08-20T15:02:00.000Z', // confirmed — keeps this an inventory demo, not a no-show
      details: 'Reception for newly enrolled families.',
    },
    // Buffer-only clash in the Gym on DEMO_TODAY: practice ends 10:00 but tears
    // down till 10:30, while PE setup starts 10:15 — the events don't overlap,
    // but the room can't be flipped in time.
    {
      ...base,
      id: 'e-buf-1',
      name: 'JV Volleyball Practice',
      owner: 'Adriana Marrero',
      location: 'Gym',
      rooms: ['Gym'],
      resources: [],
      setup_starts: null,
      teardown_ends: '2026-08-20T14:30:00.000Z', // 10:30 EDT
      starts_at: '2026-08-20T12:00:00.000Z', // 8:00 EDT
      ends_at: '2026-08-20T14:00:00.000Z', // 10:00 EDT
      details: 'Tear-down of nets & standards runs ~30 min past practice.',
    },
    {
      ...base,
      id: 'e-buf-2',
      name: 'MS PE Class',
      owner: 'Adriana Marrero',
      location: 'Gym',
      rooms: ['Gym'],
      resources: [],
      setup_starts: '2026-08-20T14:15:00.000Z', // 10:15 EDT
      teardown_ends: null,
      starts_at: '2026-08-20T14:30:00.000Z', // 10:30 EDT
      ends_at: '2026-08-20T16:00:00.000Z', // 12:00 EDT
      details: 'Needs the floor set before students arrive.',
    },
  ];
}

// A weekly recurring booking that demos series management (item S4): eight
// Thursday rehearsals sharing one seriesId, so the whole run can be moved,
// cancelled, or reinstated together from any occurrence. Starts on DEMO_TODAY.
function seedSeries(): EventRec[] {
  const base = {
    all_day: false,
    setup_starts: null,
    teardown_ends: null,
    percent_approved: 100,
    status: 'Approved',
    source: 'internal' as const,
    kind: 'booking' as const,
    resources: [],
    owner: 'Rudy Garrido',
    location: 'Band Room',
    rooms: ['Band Room'],
    recurrence: 'Weekly through Oct 8',
  };
  const startUTC = Date.UTC(2026, 7, 20, 19, 30); // Aug 20, 3:30pm EDT
  const out: EventRec[] = [];
  for (let i = 0; i < 8; i++) {
    const s = new Date(startUTC + i * 7 * 86400000);
    const e = new Date(startUTC + i * 7 * 86400000 + 90 * 60000);
    out.push({
      ...base,
      id: `e-ser-${i + 1}`,
      seriesId: 'ser-demo-rehearsal',
      name: 'Worship Team Rehearsal',
      starts_at: s.toISOString(),
      ends_at: e.toISOString(),
      details: 'Weekly student worship band rehearsal.',
    });
  }
  return out;
}

// Three bookings on DEMO_TODAY (noon EDT) that show the check-in lifecycle:
// one awaiting confirmation (owned by the default demo user, so the Home
// check-in card shows), one already checked in, and one no-show the admin can
// reclaim. See lib/checkin.
function seedCheckinDemo(): EventRec[] {
  const base = {
    all_day: false,
    setup_starts: null,
    teardown_ends: null,
    recurrence: null,
    percent_approved: 100,
    status: 'Approved',
    source: 'internal' as const,
    kind: 'booking' as const,
    resources: [],
  };
  return [
    {
      ...base,
      id: 'e-ci-open',
      name: 'Admissions Family Tour',
      owner: 'Rudy Garrido',
      location: 'TIDE Conference Room',
      rooms: ['TIDE Conference Room'],
      starts_at: '2026-08-20T16:00:00.000Z', // 12:00 EDT — check-in window open now
      ends_at: '2026-08-20T17:00:00.000Z',
      expectedAttendance: 8,
      details: 'Walkthrough for a prospective family.',
    },
    {
      ...base,
      id: 'e-ci-in',
      name: 'Chapel Rehearsal',
      owner: 'Adriana Marrero',
      location: 'Lighthouse Theater',
      rooms: ['Lighthouse Theater'],
      starts_at: '2026-08-20T15:30:00.000Z', // 11:30 EDT
      ends_at: '2026-08-20T16:30:00.000Z',
      checkInAt: '2026-08-20T15:33:00.000Z', // confirmed on time
      details: 'Worship team run-through.',
    },
    {
      ...base,
      id: 'e-ci-noshow',
      name: 'Parent Volunteer Meeting',
      owner: 'Vicki Kaplan',
      location: 'Green Room',
      rooms: ['Green Room'],
      starts_at: '2026-08-20T15:30:00.000Z', // 11:30 EDT — past grace, still in window now
      ends_at: '2026-08-20T17:00:00.000Z', // 1:00 EDT
      details: 'No one checked in — slot can be reclaimed.',
    },
  ];
}

// External facility rentals — the community/booster/outside-org bookings WCS
// actually takes. Spread across the lifecycle so the ledger shows every state:
// a confirmed church with only the invoice outstanding, a tentative league still
// missing its COI, a fresh inquiry, and a closed-out reunion. The confirmed one
// also carries a real calendar event so it conflict-checks like any booking.
function seedRentals(): { rentals: Rental[]; events: EventRec[] } {
  const rentals: Rental[] = [
    {
      id: 'rent-1',
      org: 'Grace Community Church',
      contact: 'Pastor Daniel Reyes',
      email: 'office@gracecommunity.org',
      phone: '305-555-0211',
      purpose: 'Sunday worship service',
      room: 'Lighthouse Theater',
      date: '2026-08-23',
      startTime: '08:00',
      endTime: '12:00',
      attendance: 220,
      status: 'Confirmed',
      fee: 1200,
      deposit: 500,
      coi: 'received',
      depositStatus: 'paid',
      invoiceStatus: 'invoiced', // billed, not yet paid — the one open item
      notes: 'Recurring summer arrangement while their building is renovated.',
      eventId: 'rent-evt-1',
      createdAt: '2026-07-30T10:00:00-04:00',
    },
    {
      id: 'rent-2',
      org: 'Kendall Youth Soccer League',
      contact: 'Marisol Peña',
      email: 'kysl.fields@gmail.com',
      phone: '305-555-0288',
      purpose: 'Saturday match day (U10–U14)',
      room: 'Main Football Field',
      date: '2026-08-29',
      startTime: '09:00',
      endTime: '15:00',
      attendance: 180,
      status: 'Tentative',
      fee: 800,
      deposit: 300,
      coi: 'pending', // blocks confirmation until on file
      depositStatus: 'unpaid',
      invoiceStatus: 'unpaid',
      notes: 'Waiting on their certificate of insurance before we confirm.',
      createdAt: '2026-08-12T14:20:00-04:00',
    },
    {
      id: 'rent-3',
      org: 'Miami Robotics Co-op',
      contact: 'Henry Okafor',
      email: 'hello@miamirobotics.org',
      purpose: 'Weekend STEM workshop',
      room: 'Beacon Hall',
      date: '2026-09-12',
      startTime: '09:00',
      endTime: '16:00',
      attendance: 60,
      status: 'Inquiry',
      fee: 0, // not quoted yet
      deposit: 0,
      coi: 'pending',
      depositStatus: 'unpaid',
      invoiceStatus: 'unpaid',
      notes: 'New inquiry — needs a quote and a walkthrough.',
      createdAt: '2026-08-18T09:05:00-04:00',
    },
    {
      id: 'rent-4',
      org: 'Westminster Alumni Association',
      contact: 'Carla Domínguez',
      email: 'alumni@wcsmiami.org',
      purpose: 'Class of 2016 reunion dinner',
      room: 'Beacon Hall',
      date: '2026-06-06',
      startTime: '18:00',
      endTime: '22:00',
      attendance: 140,
      status: 'Completed',
      fee: 2000,
      deposit: 500,
      coi: 'received',
      depositStatus: 'paid',
      invoiceStatus: 'paid', // fully closed out
      createdAt: '2026-04-15T11:00:00-04:00',
    },
  ];
  // Calendar events for confirmed rentals (built to match the store's builder).
  const events: EventRec[] = [
    {
      ...base,
      id: 'rent-evt-1',
      name: 'Sunday worship service (Grace Community Church)',
      kind: 'booking',
      all_day: false,
      starts_at: '2026-08-23T08:00:00-04:00',
      ends_at: '2026-08-23T12:00:00-04:00',
      location: 'Lighthouse Theater',
      owner: 'Grace Community Church',
      details: 'External rental — Grace Community Church. Contact: Pastor Daniel Reyes.',
      rooms: ['Lighthouse Theater'],
      resources: [],
      source: 'internal',
      category: 'Rental',
      expectedAttendance: 220,
    },
  ];
  return { rentals, events };
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
  // Seed delivery channels so the bell shows the email/Teams stand-ins live.
  return out.map((n) => ({ ...n, channels: ['in-app', 'email', 'teams'] as Notif['channels'] }));
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

// A few days of prior history so the audit trail reads as a living ledger on
// first load, not an empty page. Timestamps sit in the days before DEMO_TODAY
// (2026-08-20T16:00Z) and reference real seeded records so the links resolve.
function seedAudit(): AuditEntry[] {
  return [
    { id: 'au-1', at: '2026-08-13T18:22:00Z', actor: 'Rudy Garrido', action: 'New rental inquiry', entityType: 'rental', entityId: 'rent-1', entityLabel: 'Grace Community Church', detail: 'Beacon Hall · Sunday services', link: '#/rental/rent-1' },
    { id: 'au-2', at: '2026-08-14T15:05:00Z', actor: 'Rudy Garrido', action: 'COI: received', entityType: 'rental', entityId: 'rent-1', entityLabel: 'Grace Community Church', detail: 'pending → received', link: '#/rental/rent-1' },
    { id: 'au-3', at: '2026-08-14T15:06:00Z', actor: 'Rudy Garrido', action: 'Confirmed rental', entityType: 'rental', entityId: 'rent-1', entityLabel: 'Grace Community Church', detail: 'Added to calendar', link: '#/rental/rent-1' },
    { id: 'au-4', at: '2026-08-17T13:40:00Z', actor: 'Vicki Kaplan', action: 'Approved booking', entityType: 'approval', entityId: 'e-ci-open', entityLabel: 'Admissions Family Tour', detail: 'Administration', link: '#/event/e-ci-open' },
    { id: 'au-5', at: '2026-08-18T14:12:00Z', actor: 'Daniel Pérez', action: 'Marked In progress', entityType: 'work', entityId: 'w-m3', entityLabel: 'Room 204 AC not cooling', detail: 'Assigned → In progress', link: '#/work/w-m3' },
    { id: 'au-6', at: '2026-08-18T20:35:00Z', actor: 'Carlos Rivera', action: 'Logged service', entityType: 'asset', entityId: 'as-1', entityLabel: 'WCS-HVAC-001 · Gym Rooftop Unit RTU-1', detail: 'Replaced return-air filter', link: '#/asset/as-1' },
    { id: 'au-7', at: '2026-08-19T16:48:00Z', actor: 'Vicki Kaplan', action: 'Accepted overlap', entityType: 'conflict', entityLabel: 'Shared / accepted double-booking', detail: 'Theater shared — dance holds the stage, bee takes the house' },
    { id: 'au-8', at: '2026-08-20T12:30:00Z', actor: 'Rudy Garrido', action: 'Invoice: invoiced', entityType: 'rental', entityId: 'rent-1', entityLabel: 'Grace Community Church', detail: 'unpaid → invoiced', link: '#/rental/rent-1' },
    { id: 'au-9', at: '2026-08-20T13:15:00Z', actor: 'Carl Joseph', action: 'Checked in', entityType: 'booking', entityId: 'e-ci-in', entityLabel: 'Chapel Rehearsal', link: '#/event/e-ci-in' },
  ];
}

// A short conversation on a request, so the discussion thread isn't empty on
// first load. Anchored to w-m3 (Amy Williams → Jose Oviedo, the warm classroom).
function seedComments(): RequestComment[] {
  return [
    { id: 'cm-1', entityId: 'w-m3', author: 'Amy Williams', body: "Thanks for picking this up. It's worst right after lunch — is there anything we can do before Friday's parent visits?", at: '2026-08-19T13:10:00-04:00' },
    { id: 'cm-2', entityId: 'w-m3', author: 'Jose Oviedo', body: 'Looked at it this morning — the unit is low on refrigerant. Ordered the part, scheduling the fix for the 21st. I dropped a portable AC in the room for now.', at: '2026-08-19T15:42:00-04:00' },
    { id: 'cm-3', entityId: 'w-m3', author: 'Amy Williams', body: 'The portable unit is helping a lot, thank you! Friday should be fine.', at: '2026-08-20T09:05:00-04:00' },
  ];
}

// Shared starter calendar views, so the saved-view bar isn't empty on first
// load. Users can add their own on top (scoped to them).
function seedCalendarViews(): CalendarView[] {
  return [
    { id: 'cv-ath', name: 'Athletics', owner: '', shared: true, scope: 'school', folders: ['Athletics'], hideNotices: false },
    { id: 'cv-arts', name: 'Performing arts', owner: '', shared: true, scope: 'school', folders: ['Lighthouse PAC', 'The Beacon'], hideNotices: false },
    { id: 'cv-clean', name: 'Spaces only', owner: '', shared: true, scope: 'school', folders: [], hideNotices: true },
  ];
}

// Builds the initial in-memory database from the harvested seed data.
// This is the demo's starting point; the store persists edits on top of it.
export function buildSeed(): Database {
  const rooms = roomFolders.flatMap((f, fi) =>
    f.items.map((name, i) => ({
      id: `r-${fi}-${i}`,
      name,
      folder: f.name,
      ...(ROOM_CAPACITY[name] !== undefined ? { capacity: ROOM_CAPACITY[name] } : {}),
    })),
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
  const rentalsSeed = seedRentals();
  return {
    rooms,
    resources,
    people,
    events: [...internal, ...publicEvents, ...athletic, ...notices, ...seedInventoryDemand(), ...seedCheckinDemo(), ...seedSeries(), ...rentalsSeed.events],
    workItems: seedWorkItems,
    drivers: seedDrivers,
    templates: seedTemplates,
    notifications: seedNotifs(),
    conflictNotes: seedConflictNotes(),
    assets: seedAssets,
    rentals: rentalsSeed.rentals,
    audit: seedAudit(),
    comments: seedComments(),
    calendarViews: seedCalendarViews(),
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
