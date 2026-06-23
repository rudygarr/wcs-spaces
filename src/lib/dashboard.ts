// Per-user dashboard customization. Two dials: a curated grid of shortcut tiles
// (which quick-links you pin, and in what order) and show/hide toggles for the
// big standing sections. Prefs live on the person record (see PersonRec.dashboard)
// so they persist and are independent per "view as" user.
import type { DashboardPrefs } from './types';

export interface ShortcutDef {
  key: string;
  label: string;
  icon: string; // tabler icon name
  route: string;
}

// The full catalog a user can pin. Order here is the default offering order.
export const SHORTCUTS: ShortcutDef[] = [
  { key: 'calendar', label: 'Calendar', icon: 'ti-calendar', route: '/calendar' },
  { key: 'book', label: 'Book a space', icon: 'ti-calendar-plus', route: '/book' },
  { key: 'spaces', label: 'Spaces', icon: 'ti-building', route: '/spaces' },
  { key: 'invites', label: 'My invitations', icon: 'ti-mail', route: '/invites' },
  { key: 'people', label: 'People', icon: 'ti-users', route: '/people' },
  { key: 'approvals', label: 'Approvals', icon: 'ti-stamp', route: '/approvals' },
  { key: 'teams', label: 'Teams', icon: 'ti-users-group', route: '/teams' },
  { key: 'programs', label: 'Programs', icon: 'ti-layout-grid', route: '/programs' },
  { key: 'security', label: 'Security', icon: 'ti-shield-half', route: '/security' },
  { key: 'assets', label: 'Assets', icon: 'ti-box', route: '/assets' },
  { key: 'rentals', label: 'Rentals', icon: 'ti-building-community', route: '/rentals' },
  { key: 'athletics', label: 'Athletics', icon: 'ti-ball-basketball', route: '/athletics' },
  { key: 'insights', label: 'Insights', icon: 'ti-chart-bar', route: '/insights' },
  { key: 'audit', label: 'Audit log', icon: 'ti-history', route: '/audit' },
];

// What a fresh user sees until they customize.
export const DEFAULT_SHORTCUTS = ['calendar', 'book', 'spaces', 'invites'];

// The standing sections that can be hidden.
export const SECTIONS: { key: string; label: string }[] = [
  { key: 'today', label: 'Today on campus' },
  { key: 'queues', label: 'Work queues' },
  { key: 'stats', label: 'Stat widgets' },
];

export function shortcutDef(key: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.key === key);
}

// Pinned shortcuts, in the user's order (filtered to ones that still exist).
export function pinnedShortcuts(prefs?: DashboardPrefs): ShortcutDef[] {
  const keys = prefs?.shortcuts ?? DEFAULT_SHORTCUTS;
  return keys.map(shortcutDef).filter((s): s is ShortcutDef => !!s);
}

export function isSectionHidden(prefs: DashboardPrefs | undefined, key: string): boolean {
  return (prefs?.hiddenSections ?? []).includes(key);
}
