import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_TODAY, eventsOnDay, findConflicts, fmtTime, fmtDateLong, statusColor, isMine } from '../lib/data';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';

const tiles = [
  { cls: 't-book', icon: 'ti-calendar-plus', label: 'Book', to: '/book' },
  { cls: 't-maint', icon: 'ti-tool', label: 'Maintenance', to: '/requests?door=maintenance' },
  { cls: 't-it', icon: 'ti-device-laptop', label: 'IT', to: '/requests?door=it' },
  { cls: 't-ath', icon: 'ti-ball-basketball', label: 'Athletics', to: '/athletics' },
  { cls: 't-visit', icon: 'ti-id', label: 'Visitor', to: '/requests?door=visitor' },
];

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const nav = useNavigate();
  const { user } = useSession();
  const { db } = useStore();
  const [view, setView] = useState<'mine' | 'school'>('mine');
  const today = eventsOnDay(db.events, DEMO_TODAY);
  const mine = today.filter((e) => isMine(e, user.name));
  const shown = view === 'mine' ? mine : today;
  const conflicts = findConflicts(today);
  const pendingCount = db.events.filter((e) => e.status === 'Pending').length;
  const firstName = user.name.split(' ')[0];
  const needs = pendingCount + conflicts.length;

  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <div className="eyebrow">{fmtDateLong(DEMO_TODAY)}</div>
        <h1 className="greeting">
          {greet()}, {firstName}
        </h1>
        <div className="subgreet">
          {today.length} events today · {pendingCount} approvals waiting
        </div>
      </div>

      <div className="tiles" style={{ marginBottom: 30 }}>
        {tiles.map((t) => (
          <button key={t.label} className="tile" onClick={() => nav(t.to)}>
            <span className={'tile-icon ' + t.cls}>
              <i className={'ti ' + t.icon} />
            </span>
            <span className="tile-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="section-label">
        <span className="lbl">Today on campus</span>
        <span className="act" onClick={() => nav('/calendar')} style={{ cursor: 'pointer' }}>
          See all
        </span>
      </div>

      <div className="seg seg-sm" style={{ marginBottom: 14 }}>
        <button className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}>
          Your events
        </button>
        <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>
          School events
        </button>
      </div>

      <div className="list" style={{ marginBottom: 24 }}>
        {shown.length === 0 && view === 'mine' && (
          <button className="empty" style={{ width: '100%', background: 'none', border: 'none' }} onClick={() => setView('school')}>
            Nothing on your plate today — see what's happening at school →
          </button>
        )}
        {shown.length === 0 && view === 'school' && <div className="empty">Nothing scheduled.</div>}
        {shown.slice(0, 6).map((e, i) => {
          const conflicted = conflicts.some((c) => c.a === e || c.b === e);
          const notice = e.kind === 'notice';
          return (
            <div key={e.id}>
              {i > 0 && <div className="divider" />}
              <button className="row" onClick={() => nav('/event/' + e.id)}>
                <span className="time tnum">{e.all_day ? 'All day' : fmtTime(e.starts_at)}</span>
                <span
                  className="dot"
                  style={{ background: conflicted ? 'var(--bad)' : notice ? 'var(--info)' : statusColor(e.status) }}
                />
                <span className="body">
                  <span className="title">{e.name}</span>
                  <span className="sub" style={conflicted ? { color: 'var(--bad)' } : undefined}>
                    {conflicted
                      ? `${e.rooms[0]} · double-booked`
                      : notice
                        ? `${e.audience ? e.audience + ' · ' : ''}FYI — no space booked`
                        : `${e.rooms.join(', ') || 'No room'}${e.owner ? ' · ' + e.owner : ''}`}
                  </span>
                </span>
                <i className="ti ti-chevron-right chev" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="widgets" style={{ marginBottom: 24 }}>
        <button className="widget" onClick={() => nav('/calendar')}>
          <div className="widget-top">
            <span>Needs you</span>
            <i className="ti ti-flag-3" style={{ color: 'var(--warn)', fontSize: 16 }} />
          </div>
          <div className="widget-num">{needs}</div>
          <div className="widget-sub">
            {pendingCount} approvals · {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
          </div>
        </button>
        <div className="widget">
          <div className="widget-top">
            <span>School open</span>
            <span className="dot" style={{ background: 'var(--ok)' }} />
          </div>
          <div className="widget-num tnum">
            7:30<span style={{ fontSize: 17, color: 'var(--text-3)' }}>–4:00</span>
          </div>
          <div className="widget-sub">2 guards on duty</div>
        </div>
      </div>

      <div className="statstrip">
        <span>
          <b>{db.rooms.length}</b> rooms
        </span>
        <span>
          <b>{db.resources.length}</b> resources
        </span>
        <span>
          <b>{db.people.length}</b> staff
        </span>
        <span>
          <b>{db.events.length}</b> events
        </span>
      </div>
    </>
  );
}
