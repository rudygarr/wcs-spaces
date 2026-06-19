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
