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
}

export interface EventRec extends WcsEvent {
  id: string;
}

export interface Database {
  rooms: Room[];
  resources: Resource[];
  people: PersonRec[];
  events: EventRec[];
  // Bumped whenever the seed data changes. A saved DB with an older version is
  // discarded on load so returning visitors pick up new demo data automatically.
  seedVersion?: number;
}
