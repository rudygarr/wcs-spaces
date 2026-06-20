import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtTime, fmtDateLong, statusColor, findConflicts } from '../lib/data';

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateEvent } = useStore();
  const { user } = useSession();
  const ev = db.events.find((e) => e.id === id);

  if (!ev) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Event not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/calendar')}>
          Back to Calendar
        </button>
      </div>
    );
  }

  // Does this event clash with anything else in its rooms?
  const dayList = db.events.filter(
    (e) => e.starts_at && ev.starts_at && e.starts_at.slice(0, 10) === ev.starts_at.slice(0, 10),
  );
  const conflicted = findConflicts(dayList).some((c) => c.a.id === ev.id || c.b.id === ev.id);
  const canApprove = user.site_admin || user.resolves_conflicts;

  return (
    <>
      <button className="back-link" onClick={() => nav(-1)}>
        <i className="ti ti-chevron-left" /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        {ev.kind === 'notice' ? (
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--info) 14%, transparent)', color: 'var(--info)' }}>
            <i className="ti ti-info-circle" style={{ fontSize: 13, marginRight: 4 }} />
            Notice — no space booked
          </span>
        ) : (
          <span
            className="pill"
            style={{
              background: 'color-mix(in srgb, ' + statusColor(ev.status) + ' 14%, transparent)',
              color: statusColor(ev.status),
            }}
          >
            {ev.status}
          </span>
        )}
        {ev.audience && (
          <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            <i className="ti ti-users-group" style={{ fontSize: 13, marginRight: 4 }} />
            {ev.audience}
          </span>
        )}
        {ev.homeAway && (
          <span
            className="pill"
            style={{
              background: 'color-mix(in srgb, var(--gold) 16%, transparent)',
              color: 'var(--gold)',
            }}
          >
            <i className={'ti ' + (ev.homeAway === 'Home' ? 'ti-home' : 'ti-bus')} style={{ fontSize: 13, marginRight: 4 }} />
            {ev.homeAway}
          </span>
        )}
        {conflicted && (
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--bad) 14%, transparent)', color: 'var(--bad)' }}>
            Double-booked
          </span>
        )}
      </div>

      <h1 className="page-h" style={{ marginTop: 10 }}>
        {ev.name}
      </h1>

      <div style={{ marginTop: 8 }}>
        <div className="detail-meta">
          <i className="ti ti-calendar" />
          {ev.starts_at ? fmtDateLong(new Date(ev.starts_at)) : 'No date'}
        </div>
        <div className="detail-meta">
          <i className="ti ti-clock" />
          {ev.all_day ? 'All day' : `${fmtTime(ev.starts_at)} – ${fmtTime(ev.ends_at)}`}
        </div>
        <div className="detail-meta">
          <i className={'ti ' + (ev.kind === 'notice' ? 'ti-map-pin' : 'ti-door')} />
          {ev.rooms.join(', ') || ev.location || (ev.kind === 'notice' ? 'No campus space needed' : 'No room assigned')}
        </div>
        {ev.resources.length > 0 && (
          <div className="detail-meta">
            <i className="ti ti-plug-connected" />
            {ev.resources.join(', ')}
          </div>
        )}
        {ev.team && (
          <div className="detail-meta">
            <i className="ti ti-shirt-sport" />
            {ev.team}
          </div>
        )}
        {ev.opponent && (
          <div className="detail-meta">
            <i className="ti ti-swords" />
            vs {ev.opponent}
          </div>
        )}
        {ev.earlyDismissal && (
          <div className="detail-meta">
            <i className="ti ti-school" />
            Early dismissal {ev.earlyDismissal}
          </div>
        )}
        {ev.transportation && (
          <div className="detail-meta">
            <i className="ti ti-bus" />
            Transportation {ev.transportation}
          </div>
        )}
        <div className="detail-meta">
          <i className="ti ti-user" />
          {ev.owner || 'No owner'}
        </div>
        {ev.recurrence && (
          <div className="detail-meta">
            <i className="ti ti-repeat" />
            {ev.recurrence}
          </div>
        )}
        {ev.details && (
          <div className="detail-meta" style={{ alignItems: 'flex-start' }}>
            <i className="ti ti-note" />
            <span style={{ color: 'var(--text-1)' }}>{ev.details}</span>
          </div>
        )}
      </div>

      {(ev.assignments?.length ?? 0) > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Support &amp; assignments</span>
            <span className="act">{ev.assignments!.length}</span>
          </div>
          <div className="list">
            {ev.assignments!.map((a, i) => (
              <div key={a.role + a.person}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <div className="row" style={{ cursor: 'default' }}>
                  <span className="dot" style={{ background: statusColor(a.status || 'Approved') }} />
                  <span className="body">
                    <span className="title">{a.role}</span>
                    <span className="sub">{a.person}</span>
                  </span>
                  <span className="pill" style={{ background: 'var(--surface-2)', color: statusColor(a.status || 'Approved') }}>
                    {a.status || 'Approved'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {canApprove && ev.status === 'Pending' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            className="fab"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => updateEvent(ev.id, { status: 'Approved', percent_approved: 100 })}
          >
            <i className="ti ti-check" /> Approve
          </button>
          <button
            className="btn-soft"
            style={{ flex: 1, justifyContent: 'center', color: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => updateEvent(ev.id, { status: 'Declined', percent_approved: 0 })}
          >
            <i className="ti ti-x" /> Decline
          </button>
        </div>
      )}
      {canApprove && ev.status !== 'Pending' && (
        <button
          className="btn-soft"
          style={{ marginTop: 24 }}
          onClick={() => updateEvent(ev.id, { status: 'Pending', percent_approved: 0 })}
        >
          <i className="ti ti-rotate" /> Reset to pending
        </button>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
