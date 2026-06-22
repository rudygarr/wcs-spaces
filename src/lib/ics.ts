import type { EventRec } from './types';

// iCalendar (.ics) bridge. The school runs Microsoft 365, so the highest-value,
// backend-free win is letting anyone drop a booking — or their whole schedule —
// straight into Outlook / Apple Calendar / Google. A *live* subscribable webcal
// feed needs a host that re-serves an updating file, so that's a production item;
// these downloads are point-in-time snapshots, which covers the day-to-day need.

// Escape per RFC 5545: backslash, comma, semicolon, and newlines.
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

// ISO instant → UTC stamp YYYYMMDDTHHMMSSZ.
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
// All-day date form YYYYMMDD (UTC date of the instant).
function dateStamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '');
}

// Fold long lines at 75 octets, the spec's limit (Outlook is strict about it).
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

function vevent(e: EventRec): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${e.id}@wcs-spaces`];
  lines.push(`DTSTAMP:${stamp(new Date().toISOString())}`);
  if (e.all_day && e.starts_at) {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.starts_at)}`);
    if (e.ends_at) lines.push(`DTEND;VALUE=DATE:${dateStamp(e.ends_at)}`);
  } else if (e.starts_at) {
    lines.push(`DTSTART:${stamp(e.starts_at)}`);
    if (e.ends_at) lines.push(`DTEND:${stamp(e.ends_at)}`);
  }
  lines.push(`SUMMARY:${esc(e.name)}`);
  const loc = e.rooms.join(', ') || e.location || '';
  if (loc) lines.push(`LOCATION:${esc(loc)}`);
  const desc = [
    e.details || '',
    e.owner ? `Owner: ${e.owner}` : '',
    e.resources.length ? `Resources: ${e.resources.join(', ')}` : '',
    e.status ? `Status: ${e.status}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (e.status === 'Pending') lines.push('STATUS:TENTATIVE');
  else if (e.status === 'Declined') lines.push('STATUS:CANCELLED');
  else lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  return lines;
}

export function buildICS(events: EventRec[], calName = 'Steward'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Steward//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const e of events) {
    if (!e.starts_at) continue;
    lines.push(...vevent(e));
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

// Trigger a browser download of an .ics file. User-initiated (a button click in
// the app) — this is the app exporting the user's own calendar, not a fetch.
export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : filename + '.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Slug for a tidy filename.
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
}
