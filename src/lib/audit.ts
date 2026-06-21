import type { AuditEntityType, AuditEntry, Database } from './types';
import { DEMO_TODAY } from './data';

// Read-side helpers for the audit trail. The store owns appends.

export const AUDIT_META: Record<AuditEntityType, { icon: string; color: string; label: string }> = {
  booking: { icon: 'ti-calendar', color: 'var(--info)', label: 'Booking' },
  rental: { icon: 'ti-building-community', color: 'var(--green)', label: 'Rental' },
  work: { icon: 'ti-tool', color: 'var(--warn)', label: 'Work order' },
  asset: { icon: 'ti-box', color: 'var(--text-2)', label: 'Asset' },
  approval: { icon: 'ti-stamp', color: 'var(--gold)', label: 'Approval' },
  conflict: { icon: 'ti-arrows-shuffle', color: 'var(--bad)', label: 'Conflict' },
  system: { icon: 'ti-settings', color: 'var(--text-3)', label: 'System' },
};

export function auditLog(db: Database): AuditEntry[] {
  // Newest first.
  return [...(db.audit ?? [])].sort((a, b) => b.at.localeCompare(a.at));
}

// Relative phrasing against the demo's "now", falling back to a date.
export function auditTime(iso: string, now: Date = DEMO_TODAY): string {
  const t = new Date(iso).getTime();
  const diff = now.getTime() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day <= 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
