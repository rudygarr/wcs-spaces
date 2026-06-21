import type { EventRec, WorkItem, Rental } from './types';
import { DEMO_TODAY } from './data';

// ---- Reporting & export (item S3) ----
// The most universal complaint across the field (FMX, Skedda, Incident IQ, PCO)
// is reports you can't filter or get out of the tool. This is the real thing:
// date-range filters that recompute the metrics, plus CSV + print export.

type Cell = string | number | undefined | null;

// CSV quoting per RFC 4180 — wrap anything with a comma, quote, or newline.
function cell(v: Cell): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(columns: string[], rows: Cell[][]): string {
  return [columns.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
}

// Triggers a normal browser file download (standard app export — not an
// autonomous download of a remote file).
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Date-range filtering ----
export type RangeKey = 'all' | '30' | '90' | 'term';

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30', label: '±30 days' },
  { key: '90', label: '±90 days' },
  { key: 'term', label: 'Fall term' },
];

export function rangeWindow(key: RangeKey): { from: number; to: number } {
  const now = DEMO_TODAY.getTime();
  const day = 86400000;
  switch (key) {
    case '30':
      return { from: now - 30 * day, to: now + 30 * day };
    case '90':
      return { from: now - 90 * day, to: now + 90 * day };
    case 'term':
      return { from: new Date('2026-08-01T00:00:00-04:00').getTime(), to: new Date('2026-12-21T00:00:00-05:00').getTime() };
    default:
      return { from: -Infinity, to: Infinity };
  }
}

export function inWindow(iso: string | null | undefined, w: { from: number; to: number }): boolean {
  if (w.from === -Infinity && w.to === Infinity) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= w.from && t <= w.to;
}

// ---- Row builders for export ----
const fmtD = (iso?: string | null) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

export function bookingReport(events: EventRec[]): { columns: string[]; rows: Cell[][] } {
  const columns = ['Date', 'Start', 'End', 'Event', 'Owner', 'Rooms', 'Status', 'Attendance'];
  const rows = events.map((e) => [fmtD(e.starts_at), fmtT(e.starts_at), fmtT(e.ends_at), e.name, e.owner ?? '', e.rooms.join('; '), e.status, e.expectedAttendance ?? '']);
  return { columns, rows };
}

export function workReport(items: WorkItem[]): { columns: string[]; rows: Cell[][] } {
  const columns = ['Created', 'Department', 'Type', 'Title', 'Location', 'Status', 'Priority', 'Requested by', 'Assignee', 'Completed'];
  const rows = items.map((w) => [fmtD(w.createdAt), w.department, w.type, w.title, w.location, w.status, w.priority, w.requestedBy, w.assignee ?? '', fmtD(w.completedAt)]);
  return { columns, rows };
}

export function rentalReport(rentals: Rental[]): { columns: string[]; rows: Cell[][] } {
  const columns = ['Date', 'Organization', 'Contact', 'Space', 'Status', 'COI', 'Deposit', 'Invoice', 'Fee', 'Deposit amt'];
  const rows = rentals.map((r) => [fmtD(r.date), r.org, r.contact, r.room, r.status, r.coi, r.depositStatus, r.invoiceStatus, r.fee, r.deposit]);
  return { columns, rows };
}
