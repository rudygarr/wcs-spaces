import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { SeriesScope } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtTime, fmtDateLong, statusColor, findConflicts, DEMO_TODAY, dayKey } from '../lib/data';
import { checkinState, NOSHOW_GRACE_MIN } from '../lib/checkin';
import { approvalSteps, derivedStatus, canApprove as canApproveEvent } from '../lib/approvals';
import { conflictKey, isConflictResolved } from '../lib/conflicts';
import { buildICS, downloadICS, slug } from '../lib/ics';
import { ConflictThread } from '../components/ConflictThread';
import { SetupDiagram, setupStyleName } from '../components/SetupDiagram';
import { rollTimes, fmtMin, fmtDur, totalRuntime, printRunSheet, CUE_META } from '../lib/runsheet';
import AuditHistory from '../components/AuditHistory';
import RequestThread from '../components/RequestThread';
import CrewBoard from '../components/CrewBoard';
import InvitePanel from '../components/InvitePanel';
import CampBusPanel from '../components/CampBusPanel';
import CabinPanel from '../components/CabinPanel';
import RolePanel from '../components/RolePanel';
import { programOf } from '../lib/programs';
import type { ApprovalRec, EventRec } from '../lib/types';

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateEvent, checkInEvent, releaseEvent, restoreEvent, logAudit, withdrawRequest, updateSeries, setSeriesCancelled, addWorkItem } = useStore();
  const [scope, setScope] = useState<SeriesScope>('all');
  const [moveTo, setMoveTo] = useState('');
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

  // If this booking is one session of a multi-session Program, surface the link up.
  const parentProgram = programOf(db, ev);

  // Does this event clash with anything else in its rooms?
  const dayList = db.events.filter(
    (e) => e.starts_at && ev.starts_at && e.starts_at.slice(0, 10) === ev.starts_at.slice(0, 10),
  );
  // Each clash this event is part of, paired with the other booking + its
  // conversation key. Resolved (worked-out) pairs no longer count as conflicted.
  const conflictPairs = findConflicts(dayList)
    .filter((c) => c.a.id === ev.id || c.b.id === ev.id)
    .map((c) => {
      const other: EventRec = c.a.id === ev.id ? c.b : c.a;
      const key = conflictKey(c.a.id, c.b.id);
      return { other, room: c.room, key, buffer: !!c.buffer, resolved: isConflictResolved(db, key) };
    });
  const conflicted = conflictPairs.some((p) => !p.resolved);

  // Booking approval routing: each room's area owner must sign off.
  const steps = approvalSteps(db, ev);
  const mayApprove = canApproveEvent(user, steps);
  const isOverride = user.site_admin || user.resolves_conflicts;
  const pendingSteps = steps.filter((s) => s.status === 'Pending');
  const myPending = isOverride ? pendingSteps : pendingSteps.filter((s) => s.approver === user.name);

  // Check-in / no-show release. Owner or an admin/resolver can confirm use or
  // reclaim the slot.
  const ciState = checkinState(ev, DEMO_TODAY);
  const canManageCheckin = isOverride || ev.owner === user.name;

  // Run-of-show: the owner, anyone assigned to the event (AV/crew), or an admin
  // can build/edit it. Everyone can read it.
  const canEditRun =
    isOverride || ev.owner === user.name || (ev.assignments?.some((a) => a.person === user.name) ?? false);

  // Away-game transportation. An away game already implies a trip — rather than
  // re-keying the destination and date into a separate work order, spawn the
  // Transportation request straight from the calendar entry, pre-filled and
  // linked back. (Never automatic: someone presses the button.)
  const isAway = ev.homeAway === 'Away';
  const linkedTrip = db.workItems.find((w) => w.eventId === ev.id && w.department === 'Transportation');
  const canRequestTransport = isOverride || ev.owner === user.name;
  function createTransportRequest() {
    if (!ev || linkedTrip) return;
    const dest = ev.opponent || ev.location || ev.name;
    // Depart ~75 min before kickoff as a starting guess; dispatch refines.
    let outTime = '';
    if (ev.starts_at) {
      const d = new Date(ev.starts_at);
      d.setMinutes(d.getMinutes() - 75);
      outTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    const base = `lg-${Date.now().toString(36)}`;
    const tripLabel = ev.opponent ? `${ev.team ? ev.team + ' ' : ''}@ ${ev.opponent}` : ev.name;
    const w = addWorkItem({
      department: 'Transportation',
      type: 'Away game trip',
      title: `Transport — ${tripLabel}`,
      requestedBy: user.name,
      createdAt: DEMO_TODAY.toISOString(),
      status: 'New',
      priority: 'Normal',
      location: ev.location || ev.opponent || '',
      details: `Auto-created from the away-game calendar entry${typeof ev.expectedAttendance === 'number' ? ` · ~${ev.expectedAttendance} traveling` : ''}. Confirm bus, driver and times.`,
      ...(ev.starts_at ? { scheduledFor: dayKey(new Date(ev.starts_at)) } : {}),
      eventId: ev.id,
      trip: {
        destination: dest,
        legs: [
          { id: `${base}-o`, kind: 'Outbound', time: outTime },
          { id: `${base}-r`, kind: 'Return', time: '' },
        ],
      },
    });
    logAudit({ action: 'Transportation requested', entityType: 'work', entityId: w.id, entityLabel: w.title, detail: `From away game · ${dest}`, link: `#/work/${w.id}` });
    nav('/work/' + w.id);
  }

  // Recurring-series management (item S4). When this booking is one occurrence of
  // a series, the owner/admin can move, cancel, or reinstate the run — scoped to
  // just this date, this & following, or all of it.
  const series = ev.seriesId ? db.events.filter((e) => e.seriesId === ev.seriesId) : [];
  const canManageSeries = isOverride || ev.owner === user.name;
  const scopeCount =
    scope === 'one'
      ? 1
      : scope === 'all'
        ? series.length
        : series.filter((e) => (e.starts_at ?? '') >= (ev.starts_at ?? '')).length;
  const cancelledCount = series.filter((e) => e.cancelled).length;

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
    logAudit({
      action: decision === 'Approved' ? 'Approved booking' : 'Declined booking',
      entityType: 'approval',
      entityId: ev.id,
      entityLabel: ev.name,
      detail: myPending.map((s) => s.area).join(', ') || undefined,
      link: `#/event/${ev.id}`,
    });
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
        {conflicted && !ev.cancelled && (
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}>
            <i className="ti ti-alert-triangle" /> Double-booked
          </span>
        )}
        {ev.cancelled && (
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--bad) 14%, transparent)', color: 'var(--bad)' }}>
            <i className="ti ti-calendar-x" style={{ fontSize: 13, marginRight: 4 }} /> Cancelled
          </span>
        )}
      </div>

      {ev.cancelled && (
        <div className="banner" style={{ background: 'var(--surface-2)', borderColor: 'transparent', color: 'var(--text-2)', marginTop: 12 }}>
          <i className="ti ti-calendar-x" style={{ color: 'var(--bad)' }} />
          <span>This occurrence was cancelled — its room is freed. Reinstate it from the series controls below.</span>
        </div>
      )}

      {conflictPairs.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 20 }}>
            <span className="lbl">Work it out</span>
            <span className="act">{conflictPairs.filter((p) => !p.resolved).length} open</span>
          </div>
          {conflictPairs.map((p) => (
            <ConflictThread key={p.key} conflictKey={p.key} self={ev} other={p.other} room={p.room} resolved={p.resolved} buffer={p.buffer} />
          ))}
        </>
      )}

      <h1
        className="page-h"
        style={{
          marginTop: 10,
          color: ev.cancelled ? 'var(--text-3)' : conflicted ? 'var(--warn)' : undefined,
          textDecoration: ev.cancelled ? 'line-through' : undefined,
        }}
      >
        {ev.name}
      </h1>

      {parentProgram && (
        <button className="prog-tag" onClick={() => nav('/program/' + parentProgram.id)}>
          <i className="ti ti-layout-grid" /> Session of <strong>{parentProgram.name}</strong>
          <i className="ti ti-chevron-right" style={{ marginLeft: 'auto' }} />
        </button>
      )}

      <div style={{ marginTop: 8 }}>
        <div className="detail-meta">
          <i className="ti ti-calendar" />
          {ev.starts_at ? fmtDateLong(new Date(ev.starts_at)) : 'No date'}
        </div>
        <div className="detail-meta">
          <i className="ti ti-clock" />
          {ev.all_day ? 'All day' : `${fmtTime(ev.starts_at)} – ${fmtTime(ev.ends_at)}`}
        </div>
        {(ev.setup_starts || ev.teardown_ends) && (
          <div className="detail-meta">
            <i className="ti ti-clock-pause" />
            Room held {ev.setup_starts ? `from ${fmtTime(ev.setup_starts)}` : ''}
            {ev.setup_starts && ev.teardown_ends ? ' ' : ''}
            {ev.teardown_ends ? `until ${fmtTime(ev.teardown_ends)}` : ''} (setup/teardown)
          </div>
        )}
        {typeof ev.expectedAttendance === 'number' && (
          <div className="detail-meta">
            <i className="ti ti-users" />
            {ev.expectedAttendance} expected
          </div>
        )}
        {ev.climate && (ev.climate.hvac || ev.climate.lighting) && (
          <div className="detail-meta" style={{ color: 'var(--green)' }}>
            <i className="ti ti-building-cog" style={{ color: 'var(--green)' }} />
            {[ev.climate.hvac ? 'Climate' : '', ev.climate.lighting ? 'lighting' : ''].filter(Boolean).join(' + ')}
            {' '}auto-on {ev.climate.preStartMin === 0 ? 'at start' : `${ev.climate.preStartMin} min before`} (FSAutomation)
          </div>
        )}
        <div className="detail-meta">
          <i className={'ti ' + (ev.kind === 'notice' ? 'ti-map-pin' : 'ti-door')} />
          {ev.rooms.join(', ') || ev.location || (ev.kind === 'notice' ? 'No campus space needed' : 'No room assigned')}
        </div>
        {ev.resources.length > 0 && (
          <div className="detail-meta">
            <i className="ti ti-plug-connected" />
            {ev.resources
              .map((r) => {
                const q = ev.resourceQty?.[r];
                return q ? `${r} ×${q}` : r;
              })
              .join(', ')}
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

      {isAway && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Transportation</span>
          </div>
          {linkedTrip ? (
            <button className="trip-link-card" onClick={() => nav('/work/' + linkedTrip.id)}>
              <span className="trip-link-ico">
                <i className="ti ti-bus" />
              </span>
              <span className="trip-link-body">
                <span className="trip-link-title">{linkedTrip.title}</span>
                <span className="trip-link-sub">
                  {linkedTrip.trip?.destination ? linkedTrip.trip.destination + ' · ' : ''}
                  {linkedTrip.status}
                </span>
              </span>
              <i className="ti ti-chevron-right chev" />
            </button>
          ) : canRequestTransport ? (
            <button className="transport-cta" onClick={createTransportRequest}>
              <i className="ti ti-bus" /> Create transportation request
              <span className="transport-cta-sub">Pre-fills the trip to {ev.opponent || ev.location || 'the destination'} and routes it to dispatch</span>
            </button>
          ) : (
            <div className="detail-meta" style={{ color: 'var(--text-3)' }}>
              <i className="ti ti-bus" />
              No transportation requested yet.
            </div>
          )}
        </>
      )}

      {ciState === 'open' && (
        <div className="ci-card ci-open">
          <div className="ci-text">
            <span className="ci-title"><i className="ti ti-map-pin-check" /> Using this space?</span>
            <span className="ci-sub">Confirm check-in so the room isn't flagged as a no-show.</span>
          </div>
          {canManageCheckin && (
            <button className="ci-btn ci-btn-go" onClick={() => checkInEvent(ev.id)}>
              <i className="ti ti-check" /> Check in
            </button>
          )}
        </div>
      )}
      {ciState === 'in' && (
        <div className="ci-card ci-in">
          <div className="ci-text">
            <span className="ci-title"><i className="ti ti-circle-check" /> Checked in</span>
            <span className="ci-sub">Confirmed at {fmtTime(ev.checkInAt!)} — the space is in use.</span>
          </div>
        </div>
      )}
      {ciState === 'noshow' && (
        <div className="ci-card ci-noshow">
          <div className="ci-text">
            <span className="ci-title"><i className="ti ti-alert-triangle" /> No check-in</span>
            <span className="ci-sub">
              No one confirmed within {NOSHOW_GRACE_MIN} min of start. Release the slot to free the room, or check in if
              it's running.
            </span>
          </div>
          {canManageCheckin && (
            <div className="ci-actions">
              <button className="ci-btn ci-btn-go" onClick={() => checkInEvent(ev.id)}>
                <i className="ti ti-check" /> Check in
              </button>
              <button className="ci-btn ci-btn-release" onClick={() => releaseEvent(ev.id)}>
                <i className="ti ti-arrow-back-up" /> Release slot
              </button>
            </div>
          )}
        </div>
      )}
      {ciState === 'released' && (
        <div className="ci-card ci-released">
          <div className="ci-text">
            <span className="ci-title"><i className="ti ti-lock-open" /> Slot released</span>
            <span className="ci-sub">Reclaimed as a no-show — the room is free again.</span>
          </div>
          {canManageCheckin && (
            <button className="ci-btn" onClick={() => restoreEvent(ev.id)}>
              <i className="ti ti-rotate" /> Restore booking
            </button>
          )}
        </div>
      )}

      {ev.starts_at && (
        <button
          className="btn-soft"
          style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
          onClick={() => downloadICS(slug(ev.name), buildICS([ev], ev.name))}
        >
          <i className="ti ti-calendar-plus" /> Add to Outlook / calendar
        </button>
      )}

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

      {/* ---- Run of show ---- */}
      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Run of show</span>
        {ev.runSheet && ev.runSheet.segments.length > 0 && (
          <span className="act">{fmtDur(totalRuntime(ev.runSheet))}</span>
        )}
      </div>
      {ev.runSheet && ev.runSheet.segments.length > 0 ? (
        <>
          <div className="ros-view">
            {rollTimes(ev.runSheet).map(({ seg, startMin }) => (
              <div className="ros-vrow" key={seg.id}>
                <div className="ros-vtime">
                  <span className="ros-vstart">{fmtMin(startMin)}</span>
                  <span className="ros-vdur">{fmtDur(seg.durationMin)}</span>
                </div>
                <div className="ros-vbody">
                  <div className="ros-vtitle">{seg.title || 'Untitled segment'}</div>
                  {seg.who && <div className="ros-vwho">{seg.who}</div>}
                  {seg.notes && <div className="ros-vnotes">{seg.notes}</div>}
                  {(seg.crew?.length ?? 0) > 0 && (
                    <div className="ros-vchips">
                      {seg.crew!.map((c, i) => (
                        <span className="ros-chip ros-chip-crew" key={i}>
                          <i className="ti ti-user" />
                          {c.role ? `${c.role}: ` : ''}
                          {c.person}
                          {c.call ? ` · ${c.call}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {(seg.cues?.length ?? 0) > 0 && (
                    <div className="ros-vchips">
                      {seg.cues!.map((q, i) => (
                        <span
                          className="ros-chip"
                          key={i}
                          style={{ color: CUE_META[q.dept].color, borderColor: 'color-mix(in srgb, ' + CUE_META[q.dept].color + ' 40%, transparent)' }}
                        >
                          <i className={'ti ' + CUE_META[q.dept].icon} />
                          {CUE_META[q.dept].label}: {q.action}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              className="btn-soft"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => printRunSheet(ev.name, ev.starts_at ? fmtDateLong(new Date(ev.starts_at)) : '', ev.runSheet!)}
            >
              <i className="ti ti-printer" /> Print
            </button>
            {canEditRun && (
              <button className="btn-soft" style={{ flex: 1, justifyContent: 'center' }} onClick={() => nav(`/runsheet/${ev.id}`)}>
                <i className="ti ti-edit" /> Edit run sheet
              </button>
            )}
          </div>
        </>
      ) : canEditRun ? (
        <button className="btn-soft" style={{ width: '100%', justifyContent: 'center' }} onClick={() => nav(`/runsheet/${ev.id}`)}>
          <i className="ti ti-list-numbers" /> Add a run sheet
        </button>
      ) : (
        <div className="page-sub" style={{ fontSize: 13 }}>No run sheet yet.</div>
      )}

      <div style={{ marginTop: 14 }}>
        <CrewBoard ev={ev} />
      </div>

      <div style={{ marginTop: 14 }}>
        <CampBusPanel ev={ev} />
      </div>

      <div style={{ marginTop: 14 }}>
        <CabinPanel ev={ev} />
      </div>

      <div style={{ marginTop: 14 }}>
        <RolePanel ev={ev} />
      </div>

      <div style={{ marginTop: 14 }}>
        <InvitePanel ev={ev} />
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
      {/* ---- Requester self-service: withdraw a pending request ---- */}
      {ev.owner === user.name && ev.kind !== 'notice' && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Your request</span>
          </div>
          {ev.withdrawn && (
            <div className="banner" style={{ background: 'var(--warn-tint)', borderColor: 'transparent', color: 'var(--text-2)', marginBottom: 12 }}>
              <i className="ti ti-archive" style={{ color: 'var(--warn)' }} />
              <span>You withdrew this booking request — approvers no longer see it. Reinstate it anytime; the history is kept.</span>
            </div>
          )}
          {ev.status === 'Pending' &&
            (ev.withdrawn ? (
              <button className="btn-soft" onClick={() => withdrawRequest('event', ev.id, false)}>
                <i className="ti ti-rotate" /> Reinstate request
              </button>
            ) : (
              <button className="btn-soft" onClick={() => { if (confirm('Withdraw this booking request? It leaves the approval queue but you can reinstate it anytime.')) withdrawRequest('event', ev.id, true); }}>
                <i className="ti ti-archive" /> Withdraw request
              </button>
            ))}
        </>
      )}

      {/* ---- Recurring-series management (S4) ---- */}
      {ev.seriesId && series.length > 1 && canManageSeries && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Recurring series</span>
          </div>
          <div className="series-card">
            <div className="series-head">
              <i className="ti ti-repeat" />
              <span>
                {ev.recurrence || 'Repeats'} · {series.length} dates
                {cancelledCount > 0 ? ` · ${cancelledCount} cancelled` : ''}
              </span>
            </div>
            <div className="series-label">Apply changes to</div>
            <div className="seg seg-sm">
              <button className={scope === 'one' ? 'active' : ''} onClick={() => setScope('one')}>
                This event
              </button>
              <button className={scope === 'following' ? 'active' : ''} onClick={() => setScope('following')}>
                This &amp; following
              </button>
              <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
                All events
              </button>
            </div>
            <div className="series-scope-note">
              {scopeCount} event{scopeCount === 1 ? '' : 's'} will change.
            </div>

            <div className="series-action">
              <select className="series-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Move to another room…</option>
                {[...new Set(db.rooms.map((r) => r.folder))].sort().map((folder) => (
                  <optgroup key={folder} label={folder}>
                    {db.rooms
                      .filter((r) => r.folder === folder)
                      .map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button
                className="btn-soft"
                disabled={!moveTo}
                onClick={() => {
                  const n = updateSeries(ev.seriesId!, scope, ev.id, { rooms: [moveTo] });
                  setMoveTo('');
                  alert(`Moved ${n} event${n === 1 ? '' : 's'} to ${moveTo}. Any new clashes show as warnings you can work out.`);
                }}
              >
                <i className="ti ti-arrows-exchange" /> Move
              </button>
            </div>

            <div className="series-action">
              <button
                className="btn-soft"
                onClick={() => {
                  if (confirm(`Cancel ${scopeCount} event${scopeCount === 1 ? '' : 's'} in this series? This frees the rooms and is reversible — you can reinstate anytime.`))
                    setSeriesCancelled(ev.seriesId!, scope, ev.id, true);
                }}
              >
                <i className="ti ti-calendar-x" /> Cancel {scope === 'one' ? 'this' : scope === 'all' ? 'all' : 'these'}
              </button>
              {cancelledCount > 0 && (
                <button className="btn-soft" onClick={() => setSeriesCancelled(ev.seriesId!, scope, ev.id, false)}>
                  <i className="ti ti-rotate" /> Reinstate {scope === 'all' ? 'all' : 'these'}
                </button>
              )}
            </div>
            <div className="series-foot">Soft &amp; reversible — moves and cancels can be undone, and conflicts stay warnings, never blocks.</div>
          </div>
        </>
      )}

      <AuditHistory entityId={ev.id} />

      {ev.kind !== 'notice' && (
        <RequestThread
          entityId={ev.id}
          link={'#/event/' + ev.id}
          title={ev.name}
          participants={[ev.owner ?? '', ...steps.map((s) => s.approver)]}
        />
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
