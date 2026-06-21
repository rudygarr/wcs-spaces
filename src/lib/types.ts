export type EventStatus = 'Approved' | 'Pending' | 'Declined' | string;

export interface WcsEvent {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  setup_starts: string | null;
  teardown_ends: string | null;
  recurrence: string | null;
  location: string | null;
  owner: string | null;
  status: EventStatus;
  percent_approved: number;
  details: string | null;
  rooms: string[];
  resources: string[];
  // 'public' = pulled from the school's master calendar feed; 'internal' = booked in-app.
  source?: 'public' | 'internal';
  category?: string;
  // 'booking' reserves campus space; 'notice' is calendar-only awareness (camps,
  // spirit week, exam days, away games) — it can still carry assignments.
  kind?: 'booking' | 'notice';
  audience?: string;
  // Needs hanging off the event — AV, transport, chaperones — each routed on its own.
  assignments?: Assignment[];
  // Athletics: away games are notices (no campus space) but still need visibility + transport.
  team?: string;
  homeAway?: 'Home' | 'Away';
  opponent?: string;
  // From the AD's weekly schedule: ED = when students leave class; transportation =
  // bus/van departure time + driver (or vehicle), or null when none.
  earlyDismissal?: string | null;
  transportation?: string | null;
  // Visual room-setup template id (see SetupDiagram) — the layout the crew builds.
  setupStyle?: string;
  // Decisions recorded by space approvers (see lib/approvals). Only stores
  // approvers who have acted; everyone else is implicitly still pending.
  approvals?: ApprovalRec[];
  // How many of each (countable) resource this event claims — keyed by resource
  // name. Drives inventory availability (see lib/stock). A resource listed in
  // `resources` without an entry here is a request of unspecified quantity and
  // doesn't draw down stock.
  resourceQty?: Record<string, number>;
  // Expected headcount — checked against room capacity at booking time (soft).
  expectedAttendance?: number;
  // Occupancy confirmation (see lib/checkin). `checkInAt` is stamped when someone
  // confirms the space is actually in use; if nobody checks in within the grace
  // window the booking reads as a no-show and the slot can be released (reclaimed).
  // `released` frees the room/stock back up — true to the soft philosophy, it's a
  // reversible reclaim, never a punishment.
  checkInAt?: string;
  released?: boolean;
}

export interface ApprovalRec {
  approver: string; // person who signs off
  area: string; // the room folder they own (what they're approving for)
  status: 'Approved' | 'Declined';
  at: string;
}

export interface Assignment {
  role: string;
  person: string;
  status?: EventStatus;
}

export interface Person {
  name: string;
  email: string;
  event: string;
  rooms: string;
  resources: string;
  people: string;
  resolves_conflicts: boolean;
  site_admin: boolean;
}

// ---- identified records used by the store ----
export interface Room {
  id: string;
  name: string;
  folder: string;
  capacity?: number; // max occupancy; absent = uncapped / not tracked
}

export interface Resource {
  id: string;
  name: string;
  folder: string;
  // Total units the school owns. Present only for countable physical stock
  // (chairs, tables, mics, screens); services & personnel leave this undefined
  // and are treated as not stock-tracked.
  qty?: number;
  unit?: string; // e.g. 'chairs', 'units' — for display only
}

export interface PersonRec extends Person {
  id: string;
  // App state (not core identity): deactivated users are hidden from pickers
  // but keep their history. `following` = person ids whose calendar this user follows.
  active?: boolean;
  following?: string[];
  // Fulfillment role: which department this person works in, and whether they
  // can delegate (Lead) or only act on what they're assigned (Tech).
  department?: Department;
  deptRole?: 'Lead' | 'Tech';
  // How this person wants to be pinged (see NotifyPrefs). Absent = all channels on.
  notifyPrefs?: NotifyPrefs;
}

export interface EventRec extends WcsEvent {
  id: string;
}

// ---- Fulfillment: department queues & dispatch ----
// Every request, once it leaves the form, becomes a WorkItem — one uniform
// object (type + details + assignment + status) that lands in a department's
// queue. Transportation is the rich case: it carries a multi-leg Trip.
export type WorkStatus = 'New' | 'Assigned' | 'Scheduled' | 'In progress' | 'Done';
export type Department = 'Maintenance' | 'IT' | 'Transportation';
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface TripLeg {
  id: string;
  kind: 'Outbound' | 'Return';
  time?: string; // HH:MM
  bus?: string; // bus resource name
  driver?: string; // driver name
  // A double-booked driver/bus is flagged, but never blocked — dispatch can
  // accept it (the shuttle exception). Set once the human says it's fine.
  conflictOk?: boolean;
}

export interface Trip {
  destination?: string;
  legs: TripLeg[];
}

export interface WorkItem {
  id: string;
  department: Department;
  type: string;
  title: string;
  requestedBy: string;
  createdAt: string;
  completedAt?: string; // stamped when status first becomes Done — drives turnaround stats
  status: WorkStatus;
  priority: Priority;
  location?: string;
  details?: string;
  assignee?: string;
  scheduledFor?: string; // ISO date (day)
  photo?: string; // base64 data url
  setupStyle?: string;
  eventId?: string;
  trip?: Trip;
  // A piece of equipment/device assigned to this job (e.g. a loaner TV for IT,
  // a tent for Maintenance) — the non-trip equivalent of assigning a bus.
  resource?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  photo?: string; // base64 data url
  active?: boolean;
}

// A saved request template — prefills a request door so common events are one tap.
export interface Template {
  id: string;
  door: string; // 'book' | 'athletics' | ...
  name: string;
  rooms?: string[];
  resources?: string[];
  setupStyle?: string;
  needs?: string[];
  details?: string;
  builtIn?: boolean; // seeded templates can't be deleted
}

// An in-app notification, addressed to a person by name. In production these
// fan out to email / Teams via the backend; in the demo they ring the bell.
// Where a notification was delivered. 'in-app' is always on; email & Teams are
// stand-ins for the M365 channels staff actually live in (computed from the
// recipient's NotifyPrefs at send time).
export type NotifChannel = 'in-app' | 'email' | 'teams';

export interface Notif {
  id: string;
  to: string; // person name this is for
  kind: 'assigned' | 'crew' | 'done';
  title: string;
  body?: string;
  link?: string; // hash route to open when tapped
  createdAt: string;
  read?: boolean;
  channels?: NotifChannel[]; // where this went; absent = in-app only (legacy)
}

export interface NotifyPrefs {
  email: boolean;
  teams: boolean;
  digest: 'instant' | 'daily'; // batch into a daily summary vs send right away
}

// A message in a conflict's conversation. Our differentiator: a double-booking
// isn't a wall, it's a thread between the two owners to work it out (shift time,
// share the space, or accept the overlap). `accept` posts also flip the conflict
// to resolved so the warning clears everywhere.
export interface ConflictNote {
  id: string;
  conflictKey: string; // sorted pair of event ids — see conflicts.conflictKey
  author: string; // person name
  body: string;
  at: string;
  // 'accept' marks the overlap as worked-out (clears the warning); 'note' is talk.
  kind: 'note' | 'accept';
}

// A tracked piece of equipment in the asset registry. Beyond reactive repair,
// assets carry a preventive-maintenance cadence (pmIntervalDays) so routine
// service (filter swaps, inspections) is scheduled, not forgotten — the CMMS
// staple our reactive-only work orders lacked.
export interface Asset {
  id: string;
  code: string; // human asset tag, e.g. WCS-HVAC-014 (the QR/barcode value)
  name: string;
  category: 'HVAC' | 'AV' | 'Safety' | 'Kitchen' | 'Athletics' | 'IT' | 'Facilities';
  location: string; // room or area
  serial?: string;
  installedAt?: string; // ISO date
  pmIntervalDays?: number; // cadence of preventive maintenance; omit = no PM
  pmTask?: string; // what the routine service is, e.g. "Replace air filter"
  lastServiceAt?: string; // ISO date of last completed service
  serviceLog?: { at: string; by: string; note?: string }[];
  active?: boolean;
}

export interface Database {
  rooms: Room[];
  resources: Resource[];
  people: PersonRec[];
  events: EventRec[];
  workItems: WorkItem[];
  drivers: Driver[];
  templates: Template[];
  notifications: Notif[];
  conflictNotes?: ConflictNote[];
  assets?: Asset[];
  // Bumped whenever the seed data changes. A saved DB with an older version is
  // discarded on load so returning visitors pick up new demo data automatically.
  seedVersion?: number;
}
