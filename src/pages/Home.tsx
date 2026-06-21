import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_TODAY, eventsOnDay, findConflicts, fmtTime, fmtDateLong, statusColor, isMine } from '../lib/data';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { assignedToMe } from '../lib/fulfill';
import { allConflicts, CONFLICT_ICON } from '../lib/conflicts';
import { pendingForApprover } from '../lib/approvals';
import { pmDueCount } from '../lib/assets';
import { checkinState } from '../lib/checkin';

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
  const { db, checkInEvent } = useStore();
  const [view, setView] = useState<'mine' | 'school'>('mine');
  const today = eventsOnDay(db.events, DEMO_TODAY);
  const mine = today.filter((e) => isMine(e, user.name));
  const shown = view === 'mine' ? mine : today;
  const conflicts = findConflicts(today);
  const liveConflicts = allConflicts(db);
  const pendingCount = db.events.filter((e) => e.status === 'Pending').length;
  const openWork = (dept: string) => db.workItems.filter((w) => w.department === dept && w.status !== 'Done').length;
  const myTasks = db.workItems.filter((w) => w.status !== 'Done' && assignedToMe(w, user)).length;
  const myOpenReqs =
    db.workItems.filter((w) => w.requestedBy === user.name && w.status !== 'Done').length +
    db.events.filter((e) => e.owner === user.name && e.kind !== 'notice' && e.status === 'Pending').length;
  const myApprovals = pendingForApprover(db, user.name).length;
  const canSeePM = user.site_admin || user.department === 'Maintenance';
  const pmDue = pmDueCount(db);
  // Check-in: my bookings happening now that still need confirmation.
  const myCheckins = mine.filter((e) => e.owner === user.name && checkinState(e, DEMO_TODAY) === 'open');
  // No-shows today an admin/resolver can reclaim.
  const canManageNoShows = user.site_admin || user.resolves_conflicts;
  const noShows = today.filter((e) => checkinState(e, DEMO_TODAY) === 'noshow');
  const deptQueues = [
    { id: 'Maintenance', icon: 'ti-tool', cls: 't-maint' },
    { id: 'IT', icon: 'ti-device-laptop', cls: 't-it' },
    { id: 'Transportation', icon: 'ti-bus', cls: 't-ath' },
  ];
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

      {liveConflicts.length > 0 && (
        <div className="conflict-card" style={{ marginBottom: 26 }}>
          <div className="cc-head">
            <i className={'ti ' + CONFLICT_ICON} />
            <span>
              {liveConflicts.length} scheduling conflict{liveConflicts.length === 1 ? '' : 's'} need a look
            </span>
          </div>
          {liveConflicts.slice(0, 4).map((c) => (
            <button key={c.id} className="cc-row" onClick={() => nav(c.link)}>
              <span className="cc-kind">{c.kind === 'trip' ? 'Trip' : 'Room'}</span>
              <span className="cc-body">
                <span className="cc-title">{c.title}</span>
                <span className="cc-detail">{c.detail}</span>
              </span>
              <i className="ti ti-chevron-right chev" />
            </button>
          ))}
          {liveConflicts.length > 4 && (
            <button className="cc-more" onClick={() => nav('/calendar')}>
              +{liveConflicts.length - 4} more
            </button>
          )}
        </div>
      )}

      {myCheckins.length > 0 && (
        <div className="ci-card ci-open" style={{ marginTop: 0, marginBottom: 16 }}>
          <button
            className="ci-text"
            onClick={() => nav('/event/' + myCheckins[0].id)}
            style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0 }}
          >
            <span className="ci-title"><i className="ti ti-map-pin-check" /> Check in to your space</span>
            <span className="ci-sub">
              {myCheckins[0].name} · {fmtTime(myCheckins[0].starts_at)}
              {myCheckins.length > 1 ? ` · +${myCheckins.length - 1} more` : ''}
            </span>
          </button>
          <button className="ci-btn ci-btn-go" onClick={() => checkInEvent(myCheckins[0].id)}>
            <i className="ti ti-check" /> Check in
          </button>
        </div>
      )}

      {canManageNoShows && noShows.length > 0 && (
        <button
          className="row"
          onClick={() => nav(noShows.length === 1 ? '/event/' + noShows[0].id : '/calendar')}
          style={{ width: '100%', background: 'var(--warn-tint)', border: '0.5px solid var(--warn)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}
        >
          <span className="tile-icon t-ath" style={{ width: 38, height: 38, borderRadius: 11, fontSize: 18, flexShrink: 0, background: 'var(--warn)' }}>
            <i className="ti ti-user-x" />
          </span>
          <span className="body">
            <span className="title" style={{ color: 'var(--warn)' }}>No-shows today</span>
            <span className="sub">
              {noShows.length} booking{noShows.length === 1 ? '' : 's'} with no check-in — reclaim the slot{noShows.length === 1 ? '' : 's'}
            </span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

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
                  style={{ background: conflicted ? 'var(--warn)' : notice ? 'var(--info)' : statusColor(e.status) }}
                />
                <span className="body">
                  <span className="title" style={conflicted ? { color: 'var(--warn)' } : undefined}>
                    {conflicted && <i className={'ti ' + CONFLICT_ICON} style={{ fontSize: 14, marginRight: 4 }} />}
                    {e.name}
                  </span>
                  <span className="sub" style={conflicted ? { color: 'var(--warn)' } : undefined}>
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

      {myTasks > 0 && (
        <button
          className="row"
          onClick={() => nav('/queue?mine=1')}
          style={{ width: '100%', background: 'var(--green-tint)', border: '0.5px solid var(--green)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}
        >
          <span className="tile-icon t-ath" style={{ width: 38, height: 38, borderRadius: 11, fontSize: 18, flexShrink: 0 }}>
            <i className="ti ti-user-check" />
          </span>
          <span className="body">
            <span className="title" style={{ color: 'var(--green)' }}>Assigned to you</span>
            <span className="sub">{myTasks} task{myTasks === 1 ? '' : 's'} on your plate</span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

      {myApprovals > 0 && (
        <button
          className="row"
          onClick={() => nav('/approvals')}
          style={{ width: '100%', background: 'var(--warn-tint)', border: '0.5px solid var(--warn)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}
        >
          <span className="tile-icon t-maint" style={{ width: 38, height: 38, borderRadius: 11, fontSize: 18, flexShrink: 0 }}>
            <i className="ti ti-stamp" />
          </span>
          <span className="body">
            <span className="title" style={{ color: 'var(--warn)' }}>Awaiting your approval</span>
            <span className="sub">{myApprovals} booking{myApprovals === 1 ? '' : 's'} routed to you</span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

      {canSeePM && pmDue.overdue + pmDue.soon > 0 && (
        <button
          className="row"
          onClick={() => nav('/assets')}
          style={{ width: '100%', background: pmDue.overdue > 0 ? 'color-mix(in srgb, var(--bad) 9%, transparent)' : 'var(--warn-tint)', border: '0.5px solid ' + (pmDue.overdue > 0 ? 'var(--bad)' : 'var(--warn)'), borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}
        >
          <span className="tile-icon t-maint" style={{ width: 38, height: 38, borderRadius: 11, fontSize: 18, flexShrink: 0 }}>
            <i className="ti ti-tools" />
          </span>
          <span className="body">
            <span className="title" style={{ color: pmDue.overdue > 0 ? 'var(--bad)' : 'var(--warn)' }}>Preventive maintenance</span>
            <span className="sub">
              {pmDue.overdue > 0 ? `${pmDue.overdue} overdue` : ''}
              {pmDue.overdue > 0 && pmDue.soon > 0 ? ' · ' : ''}
              {pmDue.soon > 0 ? `${pmDue.soon} due soon` : ''}
            </span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

      {myOpenReqs > 0 && (
        <button
          className="row"
          onClick={() => nav('/my')}
          style={{ width: '100%', background: 'var(--surface)', border: '0.5px solid var(--border-2)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}
        >
          <span className="tile-icon t-book" style={{ width: 38, height: 38, borderRadius: 11, fontSize: 18, flexShrink: 0 }}>
            <i className="ti ti-clipboard-list" />
          </span>
          <span className="body">
            <span className="title">Your requests</span>
            <span className="sub">{myOpenReqs} in progress — track status</span>
          </span>
          <i className="ti ti-chevron-right chev" />
        </button>
      )}

      <div className="section-label">
        <span className="lbl">Work queues</span>
        <span className="act" onClick={() => nav('/queue')} style={{ cursor: 'pointer' }}>
          Open
        </span>
      </div>
      <div className="list" style={{ marginBottom: 24 }}>
        {deptQueues.map((d, i) => (
          <div key={d.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <button className="row" onClick={() => nav('/queue?dept=' + d.id)}>
              <span className={'tile-icon ' + d.cls} style={{ width: 34, height: 34, borderRadius: 10, fontSize: 17, flexShrink: 0 }}>
                <i className={'ti ' + d.icon} />
              </span>
              <span className="body">
                <span className="title">{d.id}</span>
                <span className="sub">{openWork(d.id)} open request{openWork(d.id) === 1 ? '' : 's'}</span>
              </span>
              <i className="ti ti-chevron-right chev" />
            </button>
          </div>
        ))}
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
        {user.site_admin || user.resolves_conflicts || user.department ? (
          <button className="widget" onClick={() => nav('/insights')}>
            <div className="widget-top">
              <span>Insights</span>
              <i className="ti ti-chart-bar" style={{ color: 'var(--green)', fontSize: 16 }} />
            </div>
            <div className="widget-num">{db.events.filter((e) => e.kind !== 'notice').length}</div>
            <div className="widget-sub">bookings · usage &amp; turnaround →</div>
          </button>
        ) : (
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
        )}
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
