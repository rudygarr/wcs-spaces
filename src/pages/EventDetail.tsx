import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtTime, fmtDateLong, statusColor, findConflicts } from '../lib/data';
import { approvalSteps, derivedStatus, canApprove as canApproveEvent } from '../lib/approvals';
import { SetupDiagram, setupStyleName } from '../components/SetupDiagram';
import type { ApprovalRec } from '../lib/types';

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

  // Booking approval routing: each room's area owner must sign off.
  const steps = approvalSteps(db, ev);
  const mayApprove = canApproveEvent(user, steps);
  const isOverride = user.site_admin || user.resolves_conflicts;
  const pendingSteps = steps.filter((s) => s.status === 'Pending');
  const myPending = isOverride ? pendingSteps : pendingSteps.filter((s) => s.approver === user.name);

  function act(decision: 'Approved' | 'Declined') {
    if (!ev) return;
    const now = new Date().toISOString();
    const next: ApprovalRec[] = [...(ev.approvals ?? [])];
    for (const s of myPending) {
      const rec: ApprovalRec = { approver: s.approver, area: s.area, status: decision, at: now };
      const i = next.findIndex((a) => a.approver === s.approver);
      if (i >= 0) next[i] = rec;
      else next.push(rec);
    }
    const recomputed = steps.map((s) => {
      const d = next.find((a) => a.approver === s.approver);
      return { ...s, status: d?.status ?? s.status };
    });
    const overall = derivedStatus(recomputed, decision);
    updateEvent(ev.id, { approvals: next, status: overall, percent_approved: overall === 'Approved' ? 100 : 0 });
  }

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
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}>
            <i className="ti ti-alert-triangle" /> Double-booked
          </span>
        )}
      </div>

      <h1 className="page-h" style={{ marginTop: 10, color: conflicted ? 'var(--warn)' : undefined }}>
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

      {ev.setupStyle && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Room setup</span>
          </div>
          <div className="list" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="sd-frame" style={{ width: 116, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 9, padding: 8 }}>
              <SetupDiagram id={ev.setupStyle} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
                {setupStyleName(ev.setupStyle) ?? 'Custom setup'}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                Build this layout — tap to confirm with the requester if unclear.
              </span>
            </span>
          </div>
        </>
      )}

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

      {steps.length > 0 && ev.kind !== 'notice' && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Approvals</span>
            <span className="act">{steps.filter((s) => s.status === 'Approved').length}/{steps.length} signed off</span>
          </div>
          <div className="list">
            {steps.map((s, i) => (
              <div key={s.approver}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <div className="row" style={{ cursor: 'default' }}>
                  <span className="dot" style={{ background: statusColor(s.status) }} />
                  <span className="body">
                    <span className="title">{s.approver}</span>
                    <span className="sub">
                      {s.area}
                      {s.approver === user.name ? ' · you' : ''}
                    </span>
                  </span>
                  <span className="pill" style={{ background: 'color-mix(in srgb, ' + statusColor(s.status) + ' 14%, transparent)', color: statusColor(s.status) }}>
                    {s.status === 'Pending' ? 'Awaiting' : s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {ev.status === 'Pending' && pendingSteps.length > 0 && (
            <div className="page-sub" style={{ fontSize: 13, marginTop: 8 }}>
              Waiting on {pendingSteps.map((s) => s.approver).join(', ')}.
            </div>
          )}
        </>
      )}

      {mayApprove && ev.status === 'Pending' && myPending.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="fab" style={{ flex: 1, justifyContent: 'center' }} onClick={() => act('Approved')}>
            <i className="ti ti-check" /> {isOverride && myPending.some((s) => s.approver !== user.name) ? 'Approve (override)' : 'Approve'}
          </button>
          <button
            className="btn-soft"
            style={{ flex: 1, justifyContent: 'center', color: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => act('Declined')}
          >
            <i className="ti ti-x" /> Decline
          </button>
        </div>
      )}
      {mayApprove && ev.status !== 'Pending' && (
        <button
          className="btn-soft"
          style={{ marginTop: 24 }}
          onClick={() => updateEvent(ev.id, { status: 'Pending', percent_approved: 0, approvals: [] })}
        >
          <i className="ti ti-rotate" /> Reset to pending
        </button>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
