import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { assignedToMe, canDelegate } from '../lib/fulfill';
import type { Department, Priority, WorkItem, WorkStatus } from '../lib/types';

const DEPTS: { id: Department; icon: string; cls: string }[] = [
  { id: 'Maintenance', icon: 'ti-tool', cls: 't-maint' },
  { id: 'IT', icon: 'ti-device-laptop', cls: 't-it' },
  { id: 'Transportation', icon: 'ti-bus', cls: 't-ath' },
];

// New work surfaces first; finished work sinks to the bottom.
const STATUS_ORDER: WorkStatus[] = ['New', 'Assigned', 'Scheduled', 'In progress', 'Done'];

export function priorityColor(p: Priority): string {
  if (p === 'Urgent') return 'var(--bad)';
  if (p === 'High') return 'var(--warn)';
  return 'var(--text-3)';
}

export function statusTint(s: WorkStatus): string {
  if (s === 'New') return 'var(--info)';
  if (s === 'Done') return 'var(--ok)';
  if (s === 'In progress') return 'var(--gold)';
  return 'var(--text-2)';
}

function fmtDay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Queue() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const deptParam = params.get('dept') as Department | null;
  const [dept, setDept] = useState<Department | 'All'>(deptParam ?? 'All');
  const [mineOnly, setMineOnly] = useState(params.get('mine') === '1');
  const [showDone, setShowDone] = useState(false);

  const myCount = db.workItems.filter((w) => w.status !== 'Done' && assignedToMe(w, user)).length;
  const canManageCrew = (['Maintenance', 'IT', 'Transportation'] as Department[]).some((d) => canDelegate(user, d));

  const items = db.workItems
    .filter((w) => (dept === 'All' ? true : w.department === dept))
    .filter((w) => (mineOnly ? assignedToMe(w, user) : true))
    .filter((w) => (showDone ? true : w.status !== 'Done'))
    .sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Group into status sections, preserving STATUS_ORDER.
  const groups = STATUS_ORDER.map((s) => ({ status: s, rows: items.filter((w) => w.status === s) })).filter(
    (g) => g.rows.length > 0,
  );

  const openCount = (d: Department) => db.workItems.filter((w) => w.department === d && w.status !== 'Done').length;

  function pick(d: Department | 'All') {
    setDept(d);
    if (d === 'All') setParams({});
    else setParams({ dept: d });
  }

  return (
    <>
      <h1 className="page-h">Work queues</h1>
      <div className="page-sub">Every request that needs doing — assigned, scheduled, and tracked to done.</div>

      <div className="qfilter">
        <button className={'qchip' + (dept === 'All' ? ' on' : '')} onClick={() => pick('All')}>
          All
        </button>
        {DEPTS.map((d) => (
          <button key={d.id} className={'qchip' + (dept === d.id ? ' on' : '')} onClick={() => pick(d.id)}>
            <i className={'ti ' + d.icon} /> {d.id}
            <span className="qcount">{openCount(d.id)}</span>
          </button>
        ))}
        {myCount > 0 && (
          <button className={'qchip' + (mineOnly ? ' on' : '')} onClick={() => setMineOnly((v) => !v)}>
            <i className="ti ti-user-check" /> Assigned to me
            <span className="qcount">{myCount}</span>
          </button>
        )}
        {canManageCrew && (
          <button className="qchip" onClick={() => nav(dept === 'All' ? '/team' : `/team?dept=${dept}`)}>
            <i className="ti ti-users-group" /> Manage crew
          </button>
        )}
      </div>

      {groups.length === 0 && <div className="empty">Nothing in this queue.</div>}

      {groups.map((g) => (
        <div key={g.status}>
          <div className="section-label" style={{ marginTop: 18 }}>
            <span className="lbl" style={{ color: statusTint(g.status) }}>
              {g.status}
            </span>
            <span className="act">{g.rows.length}</span>
          </div>
          <div className="list">
            {g.rows.map((w, i) => (
              <div key={w.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <WorkRow w={w} onOpen={() => nav('/work/' + w.id)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {db.workItems.some((w) => w.status === 'Done') && (
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => setShowDone((v) => !v)}>
          <i className={'ti ' + (showDone ? 'ti-eye-off' : 'ti-eye')} /> {showDone ? 'Hide' : 'Show'} completed
        </button>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}

function WorkRow({ w, onOpen }: { w: WorkItem; onOpen: () => void }) {
  const dept = DEPTS.find((d) => d.id === w.department);
  return (
    <button className="row" onClick={onOpen} style={{ alignItems: 'flex-start' }}>
      <span className={'tile-icon ' + (dept?.cls ?? '')} style={{ width: 34, height: 34, borderRadius: 10, fontSize: 17, flexShrink: 0, marginTop: 2 }}>
        <i className={'ti ' + (dept?.icon ?? 'ti-dots')} />
      </span>
      <span className="body">
        <span className="title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {w.priority !== 'Normal' && w.priority !== 'Low' && (
            <span className="dot" style={{ background: priorityColor(w.priority), width: 7, height: 7 }} />
          )}
          {w.title}
        </span>
        <span className="sub">
          {w.type}
          {w.location ? ' · ' + w.location : ''}
          {w.assignee ? ' · ' + w.assignee : ''}
          {w.scheduledFor ? ' · ' + fmtDay(w.scheduledFor) : ''}
        </span>
      </span>
      <i className="ti ti-chevron-right chev" style={{ marginTop: 6 }} />
    </button>
  );
}
