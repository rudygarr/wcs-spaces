import type { EventRec } from './types';

// Check-in / no-show release. A booking near its start time should be confirmed
// ("yes, we're using the space"). If nobody checks in within the grace window,
// it reads as a no-show and the slot can be released back to the pool. True to
// the soft philosophy: we prompt and offer to reclaim — never auto-punish, and
// a release can be undone.
export const CHECKIN_OPENS_MIN = 15; // can confirm starting 15m before the event
export const NOSHOW_GRACE_MIN = 15; // no confirmation this long after start = no-show

export type CheckinState =
  | 'none' // not applicable (notice, no time, declined, all-day, or already over)
  | 'upcoming' // too early to check in yet
  | 'open' // in the window — awaiting confirmation
  | 'in' // checked in
  | 'noshow' // grace passed with no check-in — releasable
  | 'released'; // slot reclaimed

export function checkinState(e: EventRec, now: Date): CheckinState {
  if (e.released) return 'released';
  if (e.checkInAt) return 'in';
  if (!e.starts_at || e.kind === 'notice' || e.status === 'Declined' || e.all_day) return 'none';
  const start = new Date(e.starts_at).getTime();
  const end = new Date(e.ends_at || e.starts_at).getTime();
  const t = now.getTime();
  if (t < start - CHECKIN_OPENS_MIN * 60000) return 'upcoming';
  // Once the booked window is over there's no slot left to reclaim — a past
  // unconfirmed booking is just history, not an actionable no-show.
  if (t >= end) return 'none';
  if (t > start + NOSHOW_GRACE_MIN * 60000) return 'noshow';
  return 'open';
}
