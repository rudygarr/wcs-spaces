import type { NotifChannel, NotifyPrefs, PersonRec } from './types';

// Everyone gets the in-app bell; email & Teams default on until a person opts
// out. This mirrors how a M365 school actually reaches staff.
export const DEFAULT_PREFS: NotifyPrefs = { email: true, teams: true, digest: 'instant' };

export function prefsFor(person?: PersonRec): NotifyPrefs {
  return person?.notifyPrefs ?? DEFAULT_PREFS;
}

// Which channels a message to this person goes out on.
export function channelsFor(person?: PersonRec): NotifChannel[] {
  const p = prefsFor(person);
  const out: NotifChannel[] = ['in-app'];
  if (p.email) out.push('email');
  if (p.teams) out.push('teams');
  return out;
}

export const CHANNEL_META: Record<NotifChannel, { label: string; icon: string }> = {
  'in-app': { label: 'In-app', icon: 'ti-bell' },
  email: { label: 'Email', icon: 'ti-mail' },
  teams: { label: 'Teams', icon: 'ti-brand-teams' },
};

// Synthetic school address from a staff name, matching the demo's data-scrub
// convention (real emails are stripped before deploy).
export function demoEmail(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return `${slug}@demo.wcsmiami.org`;
}
