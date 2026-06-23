import type { CueDept, RunSegment, RunSheet, EventRec } from './types';

// The production run sheet ("run of show"). The clock rolls: each segment's
// displayed start = the sheet start plus the durations of everything before it,
// so changing one duration cascades the rest — how a real rundown behaves.

// Cue disciplines, with the label/icon/color used wherever a cue chip renders.
export const CUE_META: Record<CueDept, { label: string; icon: string; color: string }> = {
  AUD: { label: 'Audio', icon: 'ti-volume', color: 'var(--info)' },
  VID: { label: 'Video', icon: 'ti-device-tv', color: 'var(--green)' },
  LX: { label: 'Lighting', icon: 'ti-bulb', color: 'var(--gold)' },
  SCB: { label: 'Scoreboard', icon: 'ti-scoreboard', color: 'var(--bad)' },
  STG: { label: 'Stage', icon: 'ti-arrow-guide', color: 'var(--text-2)' },
  OTHER: { label: 'Other', icon: 'ti-dots', color: 'var(--text-3)' },
};
export const CUE_DEPTS: CueDept[] = ['AUD', 'VID', 'LX', 'SCB', 'STG', 'OTHER'];

let n = 0;
export function newSegId(): string {
  return `seg-${Date.now().toString(36)}-${(n++).toString(36)}`;
}

export function blankSegment(): RunSegment {
  return { id: newSegId(), durationMin: 5, title: '' };
}

// A fresh sheet anchored to `start` (HH:MM) with one empty segment to edit.
export function blankSheet(start: string): RunSheet {
  return { start, segments: [blankSegment()] };
}

// "HH:MM" (24h) → minutes since midnight. Tolerant of bad input (→ 0).
export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || '').trim());
  if (!m) return 0;
  return (Number(m[1]) % 24) * 60 + (Number(m[2]) % 60);
}

// minutes-since-midnight → "6:05 PM" (12h, no leading zero on the hour).
export function fmtMin(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${mm.toString().padStart(2, '0')} ${ap}`;
}

// "1h 05m" / "45m" — a tidy duration label.
export function fmtDur(min: number): string {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export interface RolledRow {
  seg: RunSegment;
  startMin: number;
  endMin: number;
}

// Walk the segments, rolling the clock from the sheet's start time.
export function rollTimes(sheet: RunSheet): RolledRow[] {
  let t = parseHHMM(sheet.start);
  return sheet.segments.map((seg) => {
    const startMin = t;
    t += Math.max(0, seg.durationMin || 0);
    return { seg, startMin, endMin: t };
  });
}

export function totalRuntime(sheet: RunSheet): number {
  return sheet.segments.reduce((s, seg) => s + Math.max(0, seg.durationMin || 0), 0);
}

// Open a clean, print-ready rundown in a new window and trigger the print
// dialog — for handing a paper run sheet to the crew. User-initiated (button).
export function printRunSheet(eventName: string, dateLabel: string, sheet: RunSheet): void {
  const esc = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = rollTimes(sheet)
    .map(({ seg, startMin }) => {
      const crew = (seg.crew ?? []).map((c) => `${esc(c.role)}: ${esc(c.person)}${c.call ? ` (${fmtMin(parseHHMM(c.call))})` : ''}`).join('<br>');
      const cues = (seg.cues ?? []).map((q) => `<b>${CUE_META[q.dept].label}</b> — ${esc(q.action)}`).join('<br>');
      return `<tr>
        <td class="t">${fmtMin(startMin)}</td>
        <td class="d">${fmtDur(seg.durationMin)}</td>
        <td><div class="seg">${esc(seg.title) || '—'}</div>${seg.who ? `<div class="who">${esc(seg.who)}</div>` : ''}${seg.notes ? `<div class="who">${esc(seg.notes)}</div>` : ''}</td>
        <td class="sub">${crew || ''}</td>
        <td class="sub">${cues || ''}</td>
      </tr>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Run of show — ${esc(eventName)}</title>
  <style>
    body{font:13px -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;margin:32px;}
    h1{font-size:20px;margin:0 0 2px;}
    .meta{color:#666;margin:0 0 16px;font-size:13px;}
    table{border-collapse:collapse;width:100%;}
    th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#888;border-bottom:2px solid #2d5035;padding:6px 8px;}
    td{border-bottom:1px solid #e3e3e3;padding:8px;vertical-align:top;}
    td.t{font-weight:700;white-space:nowrap;color:#2d5035;}
    td.d{color:#888;white-space:nowrap;}
    .seg{font-weight:600;font-size:14px;}
    .who{color:#666;font-size:12px;margin-top:2px;}
    td.sub{font-size:12px;color:#444;}
    .foot{margin-top:14px;color:#666;font-size:12px;}
    @media print{body{margin:0;}}
  </style></head><body>
  <h1>${esc(eventName)}</h1>
  <p class="meta">Run of show · ${esc(dateLabel)} · starts ${fmtMin(parseHHMM(sheet.start))} · ${fmtDur(totalRuntime(sheet))} total</p>
  <table><thead><tr><th>Time</th><th>Len</th><th>Segment</th><th>Crew</th><th>Cues</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="foot">Generated from Steward — Westminster Christian School</p>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

// Best-guess wall-clock HH:MM for when the show starts, from the event itself.
// Uses the event's local start time; falls back to a sensible 6:00 PM.
export function deriveStart(ev: EventRec): string {
  if (ev.starts_at) {
    const d = new Date(ev.starts_at);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return '18:00';
}
