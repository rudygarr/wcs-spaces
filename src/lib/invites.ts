import type { Database, EventInvite, EventRec } from './types';
import { dayKey } from './data';

// Invites attach to an event but live in one flat array (like crew) so we can
// also ask "what am I invited to?" without scanning every event.
export function invitesFor(db: Database, eventId: string): EventInvite[] {
  return (db.invites ?? []).filter((i) => i.eventId === eventId);
}

export interface RsvpSummary {
  total: number;
  accepted: number;
  declined: number;
  tentative: number;
  noReply: number; // still 'invited'
}

export function rsvpSummary(db: Database, eventId: string): RsvpSummary {
  const list = invitesFor(db, eventId);
  return {
    total: list.length,
    accepted: list.filter((i) => i.status === 'accepted').length,
    declined: list.filter((i) => i.status === 'declined').length,
    tentative: list.filter((i) => i.status === 'tentative').length,
    noReply: list.filter((i) => i.status === 'invited').length,
  };
}

export function rsvpLabel(s: RsvpSummary): string {
  const parts = [`${s.accepted}/${s.total} in`];
  if (s.tentative) parts.push(`${s.tentative} maybe`);
  if (s.declined) parts.push(`${s.declined} out`);
  if (s.noReply) parts.push(`${s.noReply} no reply`);
  return parts.join(' · ');
}

// Invites addressed to a specific person (by their account) — drives My invites
// and the Home alert. Pending ones (still 'invited') sort to the top.
export function myInvites(db: Database, personId: string): EventInvite[] {
  return (db.invites ?? [])
    .filter((i) => i.personId === personId)
    .sort((a, b) => {
      const ap = a.status === 'invited' ? 0 : 1;
      const bp = b.status === 'invited' ? 0 : 1;
      return ap - bp;
    });
}

export function pendingInviteCount(db: Database, personId: string): number {
  return (db.invites ?? []).filter((i) => i.personId === personId && i.status === 'invited').length;
}

// Day-of reminders: invitees who still haven't replied to an event happening
// today and haven't already been reminded. The "nudge the no-shows" list.
export function dueReminders(db: Database, todayKey: string): EventInvite[] {
  const todays = new Set(
    db.events.filter((e) => e.starts_at && !e.cancelled && dayKey(new Date(e.starts_at)) === todayKey).map((e) => e.id),
  );
  return (db.invites ?? []).filter((i) => todays.has(i.eventId) && i.status === 'invited' && !i.remindedAt);
}

export function eventOfInvite(db: Database, invite: EventInvite): EventRec | undefined {
  return db.events.find((e) => e.id === invite.eventId);
}
