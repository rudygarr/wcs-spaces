import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtDateLong, DEMO_TODAY } from '../lib/data';
import type { WorkStatus } from '../lib/types';

// A request the current user submitted — either a department work item or a
// space booking. Unified so a requester tracks everything in one place.
interface MyReq {
  id: string;
  kind: 'work' | 'event';
  icon: string;
  cls: string;
  title: string;
  sub: string;
  createdAt: string;
  link: string;
  steps: string[]; // pipeline labels
  current: number; // index of current step
  status: string;
  done: boolean; // terminal (Done / Approved / Declined)
  declined: boolean;
  withdrawn: boolean; // requester pulled it back — reversible
}

const WORK_STEPS: WorkStatus[] = ['New', 'Assigned', 'Scheduled', 'In progress', 'Done'];
const EVENT_STEPS = ['Requested', 'Pending', 'Approved'];

const deptIcon: Record<string, { icon: string; cls: string }> = {
  Maintenance: { icon: 'ti-tool', cls: 't-maint' },
  IT: { icon: 'ti-device-laptop', cls: 't-it' },
  Transportation: { icon: 'ti-bus', cls: 't-ath' },
};

function fmtDay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MyRequests() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [tab, setTab] = useState<'open' | 'all'>('open');

  const reqs: MyReq[] = [];

  // Department work items I submitted.
  for (const w of db.workItems) {
    if (w.requestedBy !== user.name) continue;
    const di = deptIcon[w.department] ?? { icon: 'ti-clipboard', cls: 't-book' };
    reqs.push({
      id: w.id,
      kind: 'work',
      icon: di.icon,
      cls: di.cls,
      title: w.title,
      sub: [w.type, w.location, w.assignee && `→ ${w.assignee}`, w.scheduledFor && fmtDay(w.scheduledFor)]
        .filter(Boolean)
        .join(' · '),
      createdAt: w.createdAt,
      link: '/work/' + w.id,
      steps: WORK_STEPS,
      current: WORK_STEPS.indexOf(w.status),
      status: w.status,
      done: w.status === 'Done',
      declined: false,
      withdrawn: !!w.withdrawn,
    });
  }

  // Space bookings I own (the demo treats the owner as the requester). Only
  // track the active ones — anything upcoming, or still pending/declined —
  // so a power-booker isn't buried under a year of past approved events.
  const dayStart = new Date(DEMO_TODAY);
  dayStart.setHours(0, 0, 0, 0);
  for (const e of db.events) {
    if (e.owner !== user.name || e.kind === 'notice') continue;
    const upcoming = e.starts_at ? new Date(e.starts_at).getTime() >= dayStart.getTime() : false;
    if (e.status === 'Approved' && !upcoming) continue;
    const declined = e.status === 'Declined';
    const current = e.status === 'Approved' ? 2 : e.status === 'Declined' ? 1 : 1;
    reqs.push({
      id: e.id,
      kind: 'event',
      icon: 'ti-calendar-event',
      cls: 't-book',
      title: e.name,
      sub: [e.rooms.join(', ') || e.location, e.starts_at && fmtDay(e.starts_at)].filter(Boolean).join(' · '),
      createdAt: e.starts_at || new Date().toISOString(),
      link: '/event/' + e.id,
      steps: EVENT_STEPS,
      current,
      status: e.status,
      done: e.status === 'Approved',
      declined,
      withdrawn: !!e.withdrawn,
    });
  }

  reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const open = reqs.filter((r) => !r.done && !r.declined);
  const LIMIT = 50;
  const full = tab === 'open' ? open : reqs;
  const shown = full.slice(0, LIMIT);

  return (
    <>
      <h1 className="page-h">My requests</h1>
      <div className="page-sub">Everything you've submitted — tracked from request to done.</div>

      <div className="seg seg-sm" style={{ margin: '16px 0 18px' }}>
        <button className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>
          Open{open.length ? ` (${open.length})` : ''}
        </button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          All{reqs.length ? ` (${reqs.length})` : ''}
        </button>
      </div>

      {shown.length === 0 && (
        <div className="empty">
          {tab === 'open' ? "Nothing open — you're all caught up." : "You haven't submitted any requests yet."}
        </div>
      )}

      {shown.map((r) => (
        <button key={r.kind + r.id} className="myreq" onClick={() => nav(r.link)}>
          <div className="myreq-head">
            <span className={'tile-icon ' + r.cls} style={{ width: 34, height: 34, borderRadius: 10, fontSize: 17, flexShrink: 0 }}>
              <i className={'ti ' + r.icon} />
            </span>
            <span className="body" style={{ minWidth: 0 }}>
              <span className="title">{r.title}</span>
              <span className="sub">{r.sub}</span>
            </span>
            <span
              className="pill"
              style={{
                flexShrink: 0,
                background: r.withdrawn
                  ? 'var(--warn-tint)'
                  : r.declined
                    ? 'color-mix(in srgb, var(--bad) 14%, transparent)'
                    : r.done
                      ? 'color-mix(in srgb, var(--ok) 14%, transparent)'
                      : 'var(--surface-2)',
                color: r.withdrawn ? 'var(--warn)' : r.declined ? 'var(--bad)' : r.done ? 'var(--ok)' : 'var(--text-2)',
              }}
            >
              {r.withdrawn ? 'Withdrawn' : r.status}
            </span>
          </div>
          <div className="myreq-track">
            {r.steps.map((s, i) => (
              <span
                key={s}
                className={
                  'mt-step' +
                  (r.declined && i >= 1 ? '' : i <= r.current ? ' on' : '') +
                  (r.declined && i === 1 ? ' bad' : '')
                }
                title={s}
              />
            ))}
          </div>
        </button>
      ))}

      {full.length > LIMIT && (
        <div className="page-sub" style={{ textAlign: 'center', marginTop: 6 }}>
          Showing {LIMIT} of {full.length} — open the Calendar to see them all.
        </div>
      )}

      <div className="page-sub" style={{ marginTop: 22, fontSize: 12.5 }}>
        Submitted by {user.name} · today is {fmtDateLong(new Date())}
      </div>
      <div style={{ height: 20 }} />
    </>
  );
}
