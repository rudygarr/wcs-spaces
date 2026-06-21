import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { allConflicts } from '../lib/conflicts';
import type { Department, WorkStatus } from '../lib/types';

const DEPTS: Department[] = ['Maintenance', 'IT', 'Transportation'];
const PIPELINE: WorkStatus[] = ['New', 'Assigned', 'Scheduled', 'In progress', 'Done'];

function Bar({ label, value, max, sub, color = 'var(--green)', onClick }: { label: string; value: number; max: number; sub?: string; color?: string; onClick?: () => void }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <button className="bar-row" onClick={onClick} disabled={!onClick} style={onClick ? undefined : { cursor: 'default' }}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: pct + '%', background: color }} />
      </span>
      <span className="bar-val">{sub ?? value}</span>
    </button>
  );
}

export default function Insights() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();

  const canView = user.site_admin || user.resolves_conflicts || !!user.department;

  const m = useMemo(() => {
    // Bookings per room (real space demand).
    const roomCount = new Map<string, number>();
    for (const e of db.events) {
      if (e.kind === 'notice') continue;
      for (const r of e.rooms) roomCount.set(r, (roomCount.get(r) || 0) + 1);
    }
    const rooms = db.rooms.map((r) => ({ name: r.name, n: roomCount.get(r.name) || 0 }));
    const topRooms = [...rooms].sort((a, b) => b.n - a.n).slice(0, 8);
    const underused = rooms.filter((r) => r.n <= 1).length;

    // Work orders by department + status.
    const byDept = DEPTS.map((d) => {
      const items = db.workItems.filter((w) => w.department === d);
      return {
        dept: d,
        open: items.filter((w) => w.status !== 'Done').length,
        done: items.filter((w) => w.status === 'Done').length,
        total: items.length,
      };
    });
    const pipeline = PIPELINE.map((s) => ({ status: s, n: db.workItems.filter((w) => w.status === s).length }));

    // Turnaround: completedAt − createdAt over Done items.
    const doneWithTimes = db.workItems.filter((w) => w.status === 'Done' && w.completedAt);
    const hoursOf = (w: { createdAt: string; completedAt?: string }) =>
      (new Date(w.completedAt!).getTime() - new Date(w.createdAt).getTime()) / 3.6e6;
    const avgTurnaround = doneWithTimes.length
      ? doneWithTimes.reduce((s, w) => s + hoursOf(w), 0) / doneWithTimes.length
      : null;

    return { topRooms, underused, byDept, pipeline, avgTurnaround, doneCount: doneWithTimes.length };
  }, [db]);

  if (!canView) {
    return (
      <>
        <h1 className="page-h">Insights</h1>
        <div className="empty">Reporting is available to administrators and department leads.</div>
      </>
    );
  }

  const pendingApprovals = db.events.filter((e) => e.status === 'Pending').length;
  const openWork = db.workItems.filter((w) => w.status !== 'Done').length;
  const conflicts = allConflicts(db).length;
  const bookings = db.events.filter((e) => e.kind !== 'notice').length;

  const turnaroundLabel =
    m.avgTurnaround == null
      ? '—'
      : m.avgTurnaround < 24
        ? `${Math.round(m.avgTurnaround)}h`
        : `${(m.avgTurnaround / 24).toFixed(1)}d`;

  const maxRoom = m.topRooms[0]?.n ?? 1;
  const maxDept = Math.max(1, ...m.byDept.map((d) => d.total));
  const maxPipe = Math.max(1, ...m.pipeline.map((p) => p.n));

  const stats = [
    { label: 'Bookings', value: bookings, icon: 'ti-calendar', tint: 'var(--info)', to: '/calendar' },
    { label: 'Pending approvals', value: pendingApprovals, icon: 'ti-clock-pause', tint: 'var(--warn)', to: '/calendar' },
    { label: 'Open work', value: openWork, icon: 'ti-clipboard-list', tint: 'var(--green)', to: '/queue' },
    { label: 'Active conflicts', value: conflicts, icon: 'ti-alert-triangle', tint: 'var(--warn)', to: '/calendar' },
  ];

  return (
    <>
      <h1 className="page-h">Insights</h1>
      <div className="page-sub">How the campus is being used and how fast requests get resolved.</div>

      <div className="ins-stats">
        {stats.map((s) => (
          <button key={s.label} className="ins-stat" onClick={() => nav(s.to)}>
            <div className="ins-stat-top">
              <span>{s.label}</span>
              <i className={'ti ' + s.icon} style={{ color: s.tint }} />
            </div>
            <div className="ins-stat-num">{s.value}</div>
          </button>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 26 }}>
        <span className="lbl">Most-booked spaces</span>
        <span className="act">{m.underused} underused</span>
      </div>
      <div className="ins-card">
        {m.topRooms.map((r) => (
          <Bar key={r.name} label={r.name} value={r.n} max={maxRoom} color="var(--green)" />
        ))}
      </div>
      <div className="page-sub" style={{ marginTop: 8, fontSize: 12.5 }}>
        {m.underused} of {db.rooms.length} rooms have 1 or fewer bookings — candidates to consolidate or promote.
      </div>

      <div className="section-label" style={{ marginTop: 26 }}>
        <span className="lbl">Work orders by department</span>
      </div>
      <div className="ins-card">
        {m.byDept.map((d) => (
          <div key={d.dept} className="ins-dept">
            <div className="ins-dept-head">
              <span>{d.dept}</span>
              <span className="ins-dept-meta">
                <b style={{ color: 'var(--green)' }}>{d.open}</b> open · <b style={{ color: 'var(--ok)' }}>{d.done}</b> done
              </span>
            </div>
            <div className="ins-stack">
              <span className="ins-seg" style={{ flex: d.open || 0.001, background: 'var(--green)' }} />
              <span className="ins-seg" style={{ flex: d.done || 0.001, background: 'var(--ok)' }} />
              <span className="ins-seg" style={{ flex: Math.max(0.001, maxDept - d.total), background: 'transparent' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 26 }}>
        <span className="lbl">Request pipeline</span>
      </div>
      <div className="ins-card">
        {m.pipeline.map((p) => (
          <Bar
            key={p.status}
            label={p.status}
            value={p.n}
            max={maxPipe}
            color={p.status === 'Done' ? 'var(--ok)' : 'var(--gold)'}
            onClick={() => nav('/queue')}
          />
        ))}
      </div>

      <div className="ins-stats" style={{ marginTop: 26 }}>
        <div className="ins-stat" style={{ cursor: 'default' }}>
          <div className="ins-stat-top">
            <span>Avg resolution</span>
            <i className="ti ti-clock-check" style={{ color: 'var(--ok)' }} />
          </div>
          <div className="ins-stat-num">{turnaroundLabel}</div>
          <div className="page-sub" style={{ fontSize: 12 }}>across {m.doneCount} completed</div>
        </div>
        <div className="ins-stat" style={{ cursor: 'default' }}>
          <div className="ins-stat-top">
            <span>Completion rate</span>
            <i className="ti ti-circle-check" style={{ color: 'var(--ok)' }} />
          </div>
          <div className="ins-stat-num">
            {db.workItems.length ? Math.round((db.workItems.filter((w) => w.status === 'Done').length / db.workItems.length) * 100) : 0}%
          </div>
          <div className="page-sub" style={{ fontSize: 12 }}>of all work items</div>
        </div>
      </div>

      {user.site_admin && (
        <button
          className="space-row"
          style={{ marginTop: 22, border: '0.5px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)' }}
          onClick={() => nav('/audit')}
        >
          <span className="space-ico" style={{ background: 'var(--green-tint)', color: 'var(--green)' }}>
            <i className="ti ti-history" />
          </span>
          <span className="nm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontWeight: 550 }}>Activity log</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Who changed what — bookings, rentals, work &amp; assets</span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

      <div className="page-sub" style={{ marginTop: 18, fontSize: 12 }}>
        Demo figures from seeded data. Production would add date-range filters and export.
      </div>
      <div style={{ height: 20 }} />
    </>
  );
}
