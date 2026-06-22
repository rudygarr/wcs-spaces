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
  // FSAutomation: the booking can tell the building to get itself ready —
  // auto-activate HVAC and/or lighting ahead of the event, switching off at
  // teardown. `preStartMin` is the lead time (minutes before start, mirrors
  // Brightly's Pre-Start Value). Absent = no automation. The calendar runs the
  // building. Real BAS wiring is a deferred integration; this models the intent.
  climate?: { hvac: boolean; lighting: boolean; preStartMin: number };
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
  // The requester pulled this back before it was decided. Reversible (soft, true
  // to the philosophy) — reinstating clears it. Withdrawn requests drop out of
  // approvers' queues but keep their history.
  withdrawn?: boolean;
  // Links the occurrences of a recurring booking so the whole run can be moved,
  // edited, or cancelled together (item S4). Absent on one-off bookings.
  seriesId?: string;
  // A cancelled occurrence (reversible) — frees its room/stock and drops out of
  // approval queues, but stays visible (struck through) so the change is legible.
  cancelled?: boolean;
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
  // The requester pulled this back before it was worked. Reversible; withdrawn
  // items drop out of department queues but keep their history.
  withdrawn?: boolean;
  // IT "Emergency?" flag — mirrors SchoolDude/Incident. When set, the ticket is
  // dual-routed to the IT lead (Omar) AND the whole team on submit, and pinned
  // to the top of the pool. Distinct from priority (an emergency is always Urgent,
  // but not every Urgent item is a flagged emergency).
  emergency?: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  photo?: string; // base64 data url
  active?: boolean;
}

// ---- External facility rentals (item N) ----
// WCS rents space to outside groups (churches, leagues, community orgs). This is
// the admin-side ledger: track the booking plus the three things that gate it —
// certificate of insurance, deposit, and the final invoice. The app only RECORDS
// these (received / paid); it never takes a card or moves money (payment entry
// stays prohibited in the demo — admins reconcile against the school's real
// system). A confirmed rental spawns a calendar event so it conflict-checks and
// draws down inventory like any internal booking.
export type RentalStatus = 'Inquiry' | 'Tentative' | 'Confirmed' | 'Completed' | 'Cancelled';
export type CoiStatus = 'pending' | 'received' | 'waived';
export type PayStatus = 'unpaid' | 'invoiced' | 'paid' | 'waived';

export interface Rental {
  id: string;
  org: string; // renting organization
  contact: string; // their point of contact
  email?: string;
  phone?: string;
  purpose: string; // what the event is
  room: string; // the space they're renting
  date: string; // ISO date (day)
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  attendance?: number;
  status: RentalStatus;
  fee: number; // total rental fee the office quoted
  deposit: number; // refundable deposit required
  coi: CoiStatus; // certificate of insurance on file?
  depositStatus: PayStatus;
  invoiceStatus: PayStatus;
  notes?: string;
  eventId?: string; // linked calendar event once Confirmed
  createdAt: string;
}

// ---- Audit trail (item R) ----
// An append-only record of who did what. Every consequential action — a booking
// approved, a rental confirmed, a no-show released, an invoice marked paid — drops
// one entry here so admins can answer "who changed this, and when?". Demo-grade
// (client-side, tied to the "view as" actor); production would write server-side
// and be tamper-evident.
export type AuditEntityType = 'booking' | 'rental' | 'work' | 'asset' | 'approval' | 'conflict' | 'system';
export interface AuditEntry {
  id: string;
  at: string; // ISO timestamp
  actor: string; // who did it (the acting user)
  action: string; // short verb phrase, e.g. 'Confirmed rental'
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel: string; // the thing acted on
  detail?: string; // extra context (old → new, amount, etc.)
  link?: string; // hash route to the entity
}

// ---- Request conversation (item S2) ----
// A comment on a request (work item or booking). Competitors get dinged for
// "can't edit after submit" and "no indication when someone replies" (Incident
// IQ); this gives every request a thread, and posting one pings the other party.
export interface RequestComment {
  id: string;
  entityId: string; // the work item or event this belongs to
  author: string;
  body: string;
  at: string;
}

// A saved calendar filter (item S7). The school calendar gets jumbled at scale
// (the FMX/PCO gripe) — a named view recalls a scope + folder + notice filter in
// one tap. `shared` views ship with the demo and show for everyone; user-saved
// views are scoped to their creator.
export interface CalendarView {
  id: string;
  name: string;
  owner: string; // creator; '' for seeded/shared views
  shared?: boolean;
  scope: 'mine' | 'school';
  folders: string[]; // room folders to include; [] = all spaces
  hideNotices: boolean; // drop FYI/notice entries
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
  kind: 'assigned' | 'crew' | 'done' | 'comment';
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
  rentals?: Rental[];
  audit?: AuditEntry[];
  comments?: RequestComment[];
  calendarViews?: CalendarView[];
  // Bumped whenever the seed data changes. A saved DB with an older version is
  // discarded on load so returning visitors pick up new demo data automatically.
  seedVersion?: number;
}
