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
}

export interface Resource {
  id: string;
  name: string;
  folder: string;
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

export interface Database {
  rooms: Room[];
  resources: Resource[];
  people: PersonRec[];
  events: EventRec[];
  workItems: WorkItem[];
  drivers: Driver[];
  templates: Template[];
  // Bumped whenever the seed data changes. A saved DB with an older version is
  // discarded on load so returning visitors pick up new demo data automatically.
  seedVersion?: number;
}
