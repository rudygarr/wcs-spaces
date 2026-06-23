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
  // The production run sheet ("run of show"): a timed rundown of segments. Each
  // segment is the spine; it can carry its own crew (call sheet) and tech cues
  // (cue sheet). The clock rolls from `start` (wall-clock HH:MM) down the
  // durations, so editing one segment cascades the rest — how rundowns actually
  // work. Absent = no run sheet yet.
  runSheet?: RunSheet;
  // Pre-registered visitors (security-visitor-scope): a heads-up for the gate so
  // guards expect named guests instead of cold walk-ups. The count/contact/time
  // are logistics, not identities — actual visitor names are only ever captured
  // live at the door (see VisitorEntry) and never persisted.
  expectedVisitors?: { count: number; contact?: string; purpose?: string; time?: string };
  // Multi-session events (services-module-spec §13): a session points up to its
  // Program (a conference day, a Sunday rental). The ONLY field a session adds —
  // absent on 99% of bookings (the iron rule). The session is otherwise a full,
  // normal booking that conflict-checks, holds its room, and routes approval on
  // its own.
  programId?: string;
}

// A scheduled guard shift (security-visitor-scope): a person posted to a gate
// or patrol for a window. "Everything is a resource with a calendar" — guards
// are people-resources on the Security calendar; the coverage view reads these
// against the School-Open hours to surface gaps.
export interface GuardShift {
  id: string;
  personId: string;
  date: string; // dayKey "YYYY-MM-DD"
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM"
  post: string; // e.g. "Main Gate", "Carline", "Roving patrol"
}

// A live visitor sign-in at the gate. PRIVACY: this is the one record that
// holds a real person's name, so it is NEVER written to the persisted database
// or localStorage — it lives only in session memory (see lib/visitorLog) and
// clears on reload. The shape is defined here for type-safety only; it is
// intentionally absent from Database.
export interface VisitorEntry {
  id: string;
  names: string; // visitor name(s) as typed
  date: string; // dayKey
  time: string; // "HH:MM" arrival
  campus: string; // PS/ES, MS, HS, CCC, Office, Other
  reason: string;
  overseerName?: string; // personnel overseeing (a staff member)
  badge?: string; // visitor pass / badge number
  eventId?: string; // the booking that brought them, if any
  loggedBy: string; // the signed-in guard
  checkOutAt?: string; // "HH:MM" when they left (absent = still on campus)
}

// An invitation to attend an event (staff meeting, AP test, a bus assignment).
// Two flavors: an internal person who has an account (personId set — they RSVP
// in-app and get pinged on their channels) and an external guest with no account
// (email only — they get an emailed RSVP link to a public accept/decline page,
// no login). Either way the row tracks one person's reply.
export type InviteStatus = 'invited' | 'accepted' | 'declined' | 'tentative';
export interface EventInvite {
  id: string;
  eventId: string;
  personId?: string; // internal invitee (has an account)
  name: string; // display name, always present
  email?: string; // external (no-account) invitee — the emailed-link path
  role?: string; // optional label, e.g. "Proctor", "Camper", "Bus 1"
  busId?: string; // camp roster: which CampBus this camper is assigned to
  status: InviteStatus;
  invitedAt: string;
  respondedAt?: string;
  remindedAt?: string; // when the day-of reminder fired
  note?: string; // optional message from the organizer
}

// A chartered bus for a sleep-away camp (Warrior Week, GR8 Escape). It's a
// rental — not the school's fleet — created ad-hoc for the camp, and surfaced
// as a room so campers can be invited/assigned to it and know which bus is
// theirs. The roster is the set of EventInvites carrying this busId.
export interface CampBus {
  id: string;
  eventId: string; // the camp event this bus serves
  roomId?: string; // the matching rental Room created for it
  name: string; // "Bus 1"
  label?: string; // theme/crew/color, e.g. "Coral Crew"
  capacity?: number;
  rentalOrg?: string; // the charter company
  departInfo?: string; // "Departs 7:30 AM · Main Lot"
}

// A thin umbrella over many child sessions, where each session is a real
// WcsEvent carrying programId back up (services-module-spec §13). The parent
// holds no rooms or times itself — the children do the real work and inherit the
// entire toolbox (conflict, stock, check-in, run sheet, approval, audit) free.
export interface Program {
  id: string;
  name: string;
  owner: string;
  startsDate: string; // dayKey "YYYY-MM-DD"
  endsDate: string; // dayKey (inclusive); === startsDate for a one-day program
  status: 'Draft' | 'Submitted' | 'Approved' | 'Cancelled';
  seriesId?: string; // a recurring program (e.g. weekly Sunday service)
  rentalId?: string; // when the program is also an external rental
  notes?: string;
}

// A tech cue tied to a run-of-show segment — the discipline (audio/video/etc.)
// and what happens. The deepest A-V layer.
export type CueDept = 'AUD' | 'VID' | 'LX' | 'SCB' | 'STG' | 'OTHER';
export interface RunCue {
  dept: CueDept;
  action: string;
}

// A crew slot for a segment — the call-sheet layer. `call` is when that person
// is needed on deck (wall-clock HH:MM), which can lead the segment's start.
export interface RunCrewSlot {
  role: string;
  person: string;
  call?: string;
}

export interface RunSegment {
  id: string;
  durationMin: number; // length of this segment; drives the rolling clock
  title: string;
  who?: string; // quick lead/owner note shown inline on the row
  notes?: string;
  crew?: RunCrewSlot[];
  cues?: RunCue[];
}

export interface RunSheet {
  start: string; // wall-clock HH:MM (24h) the show begins; the clock rolls from here
  segments: RunSegment[];
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
  // A camp bus surfaced as a room (so "everything is a space"). `rental` marks
  // it as a chartered bus, NOT the school's own fleet — created ad-hoc per camp.
  isBus?: boolean;
  rental?: boolean;
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
  // Optional photo (base64 data url or inline SVG data uri). Used for vehicles
  // so drivers/crew get visual confirmation of the exact bus; uploadable per
  // resource. Buses seed with a drawn Warrior stand-in until a real photo lands.
  photo?: string;
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
  // Home dashboard customization — pinned shortcut tiles + hidden sections.
  // Absent = defaults (see lib/dashboard).
  dashboard?: DashboardPrefs;
}

// Per-user Home dashboard prefs (see lib/dashboard for the catalog + helpers).
export interface DashboardPrefs {
  shortcuts?: string[]; // ordered shortcut keys the user pinned
  hiddenSections?: string[]; // section keys the user hid
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
  scope: 'mine' | 'following' | 'school';
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
  kind: 'assigned' | 'crew' | 'done' | 'comment' | 'invite';
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

// ---- Teams: the optional people/crew layer (services-module-spec §1–§9) ----
// The Run Sheet (§12) is the universal primitive and ships already; Teams plug
// IN as "who is committed to each beat." A Team is generic — the demo seeds
// Worship + Production, but any event-volunteer team is data, not code.

// A group of roles people serve in (Chapel Worship, Production Services, …).
export interface CrewTeam {
  id: string;
  name: string;
  icon?: string; // ti-* glyph
  blurb?: string;
  leaderPersonId?: string; // coordinator / worship director / A-V lead
}

// A role within a team. Coverage is counted per position (slots default 1).
export interface CrewPosition {
  id: string;
  teamId: string;
  name: string; // "Worship Leader", "Keys", "FOH Sound", "Camera 1"
  slots?: number; // default 1; "Vocals" might be 3 — mirrors stock qty
  sort: number;
}

// Which positions a person is qualified for. A person can sit on multiple teams.
export interface CrewMember {
  id: string;
  teamId: string;
  personId: string;
  positionIds: string[]; // "Maya can play Keys or sing Vocals"
}

// A named, reusable bundle of positions stamped onto an event in one press
// ("Full Production", "Basic AV", "Livestream package", "Athletics broadcast").
export interface PositionTemplate {
  id: string;
  teamId: string;
  name: string;
  icon?: string;
  positionIds: string[];
}

// 'open'      = slot exists, nobody placed yet
// 'requested' = a person was asked, awaiting their reply
// 'accepted'  = they said yes
// 'declined'  = they said no (slot re-opens for coverage, kept for the trail)
// 'self'      = the person placed themselves — already confirmed, no round-trip
export type CrewStatus = 'open' | 'requested' | 'accepted' | 'declined' | 'self';

// One slot on one event for one position. The EVENT is the plan (§12 reframe) —
// crew rides the Spaces event that already holds the room, so there is no
// parallel "Plan" object. Applying a template creates a row per slot as 'open'.
export interface CrewAssignment {
  id: string;
  eventId: string;
  teamId: string;
  positionId: string;
  personId?: string; // unset while 'open'
  status: CrewStatus;
  requestedAt?: string; // stamped DEMO_TODAY (demo-frame rule)
  respondedAt?: string;
}

// Person-level unavailability. Soft — scheduling onto a blockout warns, never
// blocks (conflict philosophy). Demo uses all-day, date-range blockouts.
export interface Blockout {
  id: string;
  personId: string;
  start: string; // dayKey "YYYY-MM-DD"
  end: string; // dayKey (inclusive)
  allDay: boolean;
  reason?: string;
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
  // Teams / crew layer (optional; absent on a fresh older DB).
  crewTeams?: CrewTeam[];
  crewPositions?: CrewPosition[];
  crewMembers?: CrewMember[];
  positionTemplates?: PositionTemplate[];
  crewAssignments?: CrewAssignment[];
  blockouts?: Blockout[];
  // Multi-session "Program" containers (§13). Sessions live in `events` with a
  // programId; this array holds only the thin umbrellas.
  programs?: Program[];
  // Event invitations (staff meetings, AP tests, bus rosters). Internal +
  // external (no-account) guests; see lib/invites.
  invites?: EventInvite[];
  // Chartered camp buses (rental) surfaced as rooms; see lib/camps.
  campBuses?: CampBus[];
  // Security: scheduled guard shifts (security-visitor-scope). Visitor sign-ins
  // are deliberately NOT here — they live in session memory only, never on disk.
  guardShifts?: GuardShift[];
  // Bumped whenever the seed data changes. A saved DB with an older version is
  // discarded on load so returning visitors pick up new demo data automatically.
  seedVersion?: number;
}
