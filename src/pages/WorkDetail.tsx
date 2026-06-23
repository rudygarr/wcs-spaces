import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { canDelegate, canWorkPool, inPool, deptTeam, assignedToMe } from '../lib/fulfill';
import { IT_EMERGENCY_CONTACT } from '../data/it-problem-types';
import { legCollision, driverBusyElsewhere } from '../lib/conflicts';
import { driverLoad, suggestDriver, WEEKLY_SOFT_CAP } from '../lib/drivers';
import { isVehicle, busPhoto } from '../lib/busPhoto';
import { SetupDiagram, setupStyleName } from '../components/SetupDiagram';
import AuditHistory from '../components/AuditHistory';
import RequestThread from '../components/RequestThread';
import { statusTint, priorityColor } from './Queue';
import type { Priority, TripLeg, WorkItem, WorkStatus } from '../lib/types';

const STATUSES: WorkStatus[] = ['New', 'Assigned', 'Scheduled', 'In progress', 'Done'];
const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent'];

// 6:00 a.m. → 9:00 p.m. in 15-min steps, for the time dropdowns.
const TIMES: { v: string; label: string }[] = [];
for (let h = 6; h <= 21; h++) {
  for (const m of [0, 15, 30, 45]) {
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hr = h % 12 === 0 ? 12 : h % 12;
    const label = `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
    TIMES.push({ v, label });
  }
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 'var(--r-sm)',
  border: '0.5px solid var(--border-2)',
  background: 'var(--surface)',
  color: 'var(--text-1)',
  padding: '0 12px',
  fontSize: 15,
  fontFamily: 'inherit',
  appearance: 'none',
};

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
        {children}
      </select>
      <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-3)', pointerEvents: 'none' }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function timeLabel(v?: string): string {
  if (!v) return 'Time TBD';
  const t = TIMES.find((x) => x.v === v);
  return t ? t.label : v;
}

// What a driver or a coach sees: the trip, laid out, nothing to edit.
function ReadOnlyTrip({ w }: { w: WorkItem }) {
  const { db } = useStore();
  // Prefer a real uploaded photo on the vehicle resource; fall back to the
  // drawn Warrior stand-in so the driver/coach always sees *which* bus.
  const photoFor = (bus?: string): string | null => {
    if (!bus) return null;
    const r = db.resources.find((x) => x.name === bus);
    if (r?.photo) return r.photo;
    return isVehicle(bus) ? busPhoto(bus) : null;
  };
  if (!w.trip) return null;
  return (
    <>
      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Trip</span>
      </div>
      {w.scheduledFor && (
        <div className="detail-meta">
          <i className="ti ti-calendar" />
          {new Date(w.scheduledFor + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      )}
      {w.trip.legs.map((leg) => (
        <div key={leg.id} className="leg">
          <div className="leg-head">
            <i className={'ti ' + (leg.kind === 'Outbound' ? 'ti-arrow-right' : 'ti-arrow-back-up')} />
            {leg.kind} {w.trip!.destination ? (leg.kind === 'Outbound' ? '→ ' + w.trip!.destination : '→ WCS') : ''}
          </div>
          <div className="detail-meta" style={{ margin: 0 }}>
            <i className="ti ti-clock" />
            {timeLabel(leg.time)}
          </div>
          <div className="detail-meta" style={{ margin: '6px 0 0' }}>
            <i className="ti ti-steering-wheel" />
            {leg.driver || 'Driver TBD'}
          </div>
          <div className="detail-meta" style={{ margin: '6px 0 0' }}>
            <i className="ti ti-bus" />
            {leg.bus || 'Vehicle TBD'}
          </div>
          {photoFor(leg.bus) && <img className="leg-bus-photo" src={photoFor(leg.bus)!} alt={leg.bus} />}
        </div>
      ))}
    </>
  );
}

export default function WorkDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateWorkItem, addDriver, notify, withdrawRequest } = useStore();
  const { user } = useSession();
  const w = db.workItems.find((x) => x.id === id);
  const [addingDriver, setAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftDetails, setDraftDetails] = useState('');

  if (!w) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Work item not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/queue')}>
          Back to queue
        </button>
      </div>
    );
  }

  // Delegation permissions: a department Lead (or site admin) can assign and
  // re-route work; the person it's assigned to can move it along; anyone else
  // just watches. Mirrors how the production backend will gate these actions.
  // IT is a flat pool: any tech (or admin) can assign, route, and close. Other
  // departments stay Lead-gated. `mayDelegate` powers the assign/priority UI;
  // `poolMember` distinguishes an IT teammate from an actual Lead for copy.
  const mayDelegate = canWorkPool(user, w.department);
  const poolMember = inPool(user, w.department) && !canDelegate(user, w.department);
  const mine = assignedToMe(w, user);
  const mayProgress = mayDelegate || mine;
  // "Assign to Me" (Incident's signature button) — available to anyone who can
  // work the pool and isn't already the assignee.
  const canGrab = mayDelegate && w.assignee !== user.name && !w.trip;
  function assignToMe() {
    updateWorkItem(w!.id, { assignee: user.name, status: w!.status === 'New' ? 'Assigned' : w!.status });
  }
  const team = deptTeam(db.people, w.department);
  const drivers = db.drivers.filter((d) => d.active !== false);
  const buses = db.resources.filter((r) => r.folder === 'Transportation').map((r) => r.name);
  // Photo for an assigned vehicle: uploaded resource photo, else the drawn stand-in.
  const legBusPhoto = (bus?: string): string | null => {
    if (!bus) return null;
    const r = db.resources.find((x) => x.name === bus);
    if (r?.photo) return r.photo;
    return isVehicle(bus) ? busPhoto(bus) : null;
  };
  // Equipment this department can hand to a job (IT devices, maintenance gear).
  const deptResources = db.resources.filter((r) => r.folder === w.department).map((r) => r.name);

  // A bus is "in use" if another trip on the same day already has it on a leg.
  const busInUse = (bus: string, legId: string) =>
    db.workItems.some(
      (other) =>
        other.id !== w.id &&
        other.scheduledFor &&
        other.scheduledFor === w.scheduledFor &&
        other.trip?.legs.some((l) => l.bus === bus),
    ) || (w.trip?.legs.some((l) => l.id !== legId && l.bus === bus) ?? false);


  function setStatus(s: WorkStatus) {
    updateWorkItem(w!.id, { status: s });
    // Close the loop: tell the requester when their request is done.
    if (s === 'Done' && w!.requestedBy && w!.requestedBy !== user.name) {
      notify({ to: w!.requestedBy, kind: 'done', title: `Completed: ${w!.title}`, body: w!.location ?? undefined, link: `#/work/${w!.id}` });
    }
  }
  function delegateTo(v: string) {
    updateWorkItem(w!.id, { assignee: v, status: w!.status === 'New' && v ? 'Assigned' : w!.status });
    if (v && v !== w!.assignee && v !== user.name) {
      notify({ to: v, kind: 'assigned', title: `New task: ${w!.title}`, body: w!.location ?? undefined, link: `#/work/${w!.id}` });
    }
  }
  function updateLeg(legId: string, patch: Partial<TripLeg>) {
    if (!w!.trip) return;
    const legs = w!.trip.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l));
    updateWorkItem(w!.id, { trip: { ...w!.trip, legs } });
    const prev = w!.trip.legs.find((l) => l.id === legId)?.driver;
    if (patch.driver && patch.driver !== prev && patch.driver !== user.name) {
      notify({ to: patch.driver, kind: 'assigned', title: `You're driving: ${w!.title}`, body: w!.trip.destination ?? undefined, link: `#/work/${w!.id}` });
    }
  }
  // Fair rotation: pick the lightest available driver for one leg.
  function autoAssignLeg(leg: TripLeg) {
    const pick = suggestDriver(db, w!, leg);
    if (pick && pick.name !== leg.driver) updateLeg(leg.id, { driver: pick.name });
  }
  // Fill every empty driver slot fairly. For a round trip we keep one driver on
  // both legs when they're free — only spread across drivers when needed.
  function autoAssignTrip() {
    if (!w!.trip) return;
    let legs = w!.trip.legs.map((l) => ({ ...l }));
    let dirty = false;
    for (const leg of legs) {
      if (leg.driver) continue;
      const mate = legs.find((l) => l.id !== leg.id && l.driver);
      const reuse =
        mate?.driver && !driverBusyElsewhere(db, w!, mate.driver) && !legs.some((l) => l.driver === mate.driver && l.id !== leg.id && l.id !== mate.id)
          ? mate.driver
          : null;
      const pick = reuse ?? suggestDriver(db, { ...w!, trip: { ...w!.trip, legs } }, leg)?.name;
      if (pick) {
        leg.driver = pick;
        dirty = true;
        if (pick !== user.name) notify({ to: pick, kind: 'assigned', title: `You're driving: ${w!.title}`, body: w!.trip.destination ?? undefined, link: `#/work/${w!.id}` });
      }
    }
    if (dirty) updateWorkItem(w!.id, { trip: { ...w!.trip, legs } });
  }
  function saveDriver() {
    const name = newDriver.trim();
    if (!name) return;
    addDriver({ name });
    setNewDriver('');
    setAddingDriver(false);
  }

  const isTransport = w.department === 'Transportation' && w.trip;

  return (
    <>
      <button className="back-link" onClick={() => nav('/queue')}>
        <i className="ti ti-chevron-left" /> Queue
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          {w.department}
        </span>
        <span className="pill" style={{ background: 'color-mix(in srgb, ' + statusTint(w.status) + ' 16%, transparent)', color: statusTint(w.status) }}>
          {w.status}
        </span>
        {w.priority !== 'Normal' && w.priority !== 'Low' && (
          <span className="pill" style={{ background: 'color-mix(in srgb, ' + priorityColor(w.priority) + ' 16%, transparent)', color: priorityColor(w.priority) }}>
            <i className="ti ti-flag-3" style={{ fontSize: 12, marginRight: 4 }} />
            {w.priority}
          </span>
        )}
      </div>

      <h1 className="page-h" style={{ marginTop: 10 }}>
        {w.title}
      </h1>

      <div style={{ marginTop: 8 }}>
        <div className="detail-meta">
          <i className="ti ti-user" />
          Requested by {w.requestedBy}
        </div>
        {w.location && (
          <div className="detail-meta">
            <i className="ti ti-map-pin" />
            {w.location}
          </div>
        )}
        <div className="detail-meta">
          <i className="ti ti-clock" />
          Opened {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        {w.details && (
          <div className="detail-meta" style={{ alignItems: 'flex-start' }}>
            <i className="ti ti-note" />
            <span style={{ color: 'var(--text-1)' }}>{w.details}</span>
          </div>
        )}
      </div>

      {w.photo && (
        <img
          src={w.photo}
          alt="Reported by requester"
          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '0.5px solid var(--border-2)', marginTop: 16, display: 'block' }}
        />
      )}

      {w.setupStyle && (
        <div className="list" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <span style={{ width: 100, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 9, padding: 8 }}>
            <SetupDiagram id={w.setupStyle} />
          </span>
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{setupStyleName(w.setupStyle) ?? 'Custom setup'}</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)' }}>Build this layout.</span>
          </span>
        </div>
      )}

      {/* Flagged IT emergency — surfaced loud, with who it routed to. */}
      {w.emergency && (
        <div className="banner" style={{ background: 'var(--bad-tint)', borderColor: 'transparent', color: 'var(--text-1)', marginTop: 18 }}>
          <i className="ti ti-alert-triangle-filled" style={{ color: 'var(--bad)' }} />
          <span>
            <b>Emergency</b> — routed to {IT_EMERGENCY_CONTACT.name} ({IT_EMERGENCY_CONTACT.phone}) and the whole IT team. Grab it or shadow whoever does.
          </span>
        </div>
      )}

      {/* Who's allowed to act, so the demo reads clearly when "viewing as" someone. */}
      <div className="banner" style={{ background: 'var(--surface-2)', borderColor: 'transparent', color: 'var(--text-2)', marginTop: 18 }}>
        <i className={'ti ' + (mayDelegate ? 'ti-arrows-split-2' : mine ? 'ti-user-check' : 'ti-eye')} style={{ color: mayDelegate ? 'var(--green)' : mine ? 'var(--gold)' : 'var(--text-3)' }} />
        <span>
          {poolMember
            ? 'IT shared pool — grab this yourself, hand it to a teammate, or close it. Anyone on the team can.'
            : mayDelegate
              ? user.department === w.department
                ? `You lead ${w.department} — assign this to your crew and set its priority.`
                : `As an administrator, you can assign this to the ${w.department} crew and set its priority.`
              : mine
                ? 'This is assigned to you — move it along as you work it.'
                : `Read-only — only ${w.department} can assign and update this.`}
        </span>
      </div>

      {/* Incident's "Assign to Me" — one tap to pull a pool ticket onto your plate. */}
      {canGrab && (
        <button className="fab" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }} onClick={assignToMe}>
          <i className="ti ti-user-check" /> {w.assignee ? 'Reassign to me' : 'Assign to me'}
        </button>
      )}

      {/* ---- Status pipeline ---- */}
      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Status</span>
      </div>
      <div className="statusbar">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={'statusstep' + (w.status === s ? ' on' : '')}
            disabled={!mayProgress}
            style={!mayProgress ? { opacity: w.status === s ? 1 : 0.45, cursor: 'default' } : undefined}
            onClick={() => mayProgress && setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {mayDelegate && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Priority</span>
          </div>
          <div className="statusbar">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                className={'statusstep' + (w.priority === p ? ' on' : '')}
                style={w.priority === p ? { borderColor: priorityColor(p), color: priorityColor(p), background: 'color-mix(in srgb, ' + priorityColor(p) + ' 12%, transparent)' } : undefined}
                onClick={() => updateWorkItem(w.id, { priority: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---- Transportation dispatch ---- */}
      {isTransport ? (
        mayDelegate ? (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Trip — assign a bus &amp; driver per leg</span>
            {w.trip!.legs.some((l) => !l.driver) && (
              <button className="auto-link" onClick={autoAssignTrip} title="Assign the fairest available drivers">
                <i className="ti ti-wand" /> Auto-assign drivers
              </button>
            )}
          </div>
          <Field label="Scheduled date">
            <input type="date" style={{ ...fieldStyle, appearance: 'auto' }} value={w.scheduledFor ?? ''} onChange={(e) => updateWorkItem(w.id, { scheduledFor: e.target.value })} />
          </Field>
          {w.trip!.legs.map((leg) => {
            const col = legCollision(db, w, leg);
            const dConflict = col.driverTrip;
            const bConflict = col.busTrip;
            const hasConflict = col.has;
            return (
            <div key={leg.id} className="leg" style={hasConflict && !col.resolved ? { borderColor: 'var(--warn)' } : undefined}>
              <div className="leg-head">
                <i className={'ti ' + (leg.kind === 'Outbound' ? 'ti-arrow-right' : 'ti-arrow-back-up')} />
                {leg.kind} {w.trip!.destination ? (leg.kind === 'Outbound' ? '→ ' + w.trip!.destination : '→ WCS') : ''}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>Departs</div>
                  <Sel value={leg.time ?? ''} onChange={(v) => updateLeg(leg.id, { time: v })}>
                    <option value="">Time…</option>
                    {TIMES.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </Sel>
                </div>
                <div style={{ flex: 1.4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Driver</span>
                    <button className="auto-link sm" onClick={() => autoAssignLeg(leg)} title="Pick the fairest available driver">
                      <i className="ti ti-wand" /> Auto
                    </button>
                  </div>
                  <Sel value={leg.driver ?? ''} onChange={(v) => (v === '__add' ? setAddingDriver(true) : updateLeg(leg.id, { driver: v }))}>
                    <option value="">Pick driver…</option>
                    {drivers.map((d) => {
                      const load = driverLoad(db, d.name);
                      const busy = leg.driver !== d.name && driverBusyElsewhere(db, w, d.name);
                      return (
                        <option key={d.id} value={d.name}>
                          {d.name} · {load.hours}h
                          {load.overCap ? ' ⚠ over cap' : ''}
                          {busy ? ' — driving elsewhere' : ''}
                        </option>
                      );
                    })}
                    <option value="__add">+ Add a driver…</option>
                  </Sel>
                  {leg.driver && (() => {
                    const load = driverLoad(db, leg.driver);
                    return (
                      <div className={'drv-hours' + (load.overCap ? ' over' : '')}>
                        <i className={'ti ' + (load.overCap ? 'ti-alert-triangle' : 'ti-clock')} />
                        {load.hours}h this week · {load.trips} trip{load.trips === 1 ? '' : 's'}
                        {load.overCap ? ` — over ${WEEKLY_SOFT_CAP}h soft cap` : ''}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>Bus / vehicle</div>
                <Sel value={leg.bus ?? ''} onChange={(v) => updateLeg(leg.id, { bus: v })}>
                  <option value="">Pick a vehicle…</option>
                  {buses.map((b) => (
                    <option key={b} value={b}>
                      {b}
                      {leg.bus !== b && busInUse(b, leg.id) ? '  — in use that day' : ''}
                    </option>
                  ))}
                </Sel>
                {legBusPhoto(leg.bus) && <img className="leg-bus-photo" src={legBusPhoto(leg.bus)!} alt={leg.bus} />}
              </div>

              {hasConflict &&
                (col.resolved ? (
                  <div className="conflict-ok">
                    <span>
                      <i className="ti ti-circle-check" /> Double-booking accepted — dispatch will shuttle.
                    </span>
                    {leg.conflictOk && <button onClick={() => updateLeg(leg.id, { conflictOk: false })}>Undo</button>}
                  </div>
                ) : (
                  <div className="conflict-warn">
                    <div className="cw-msg">
                      <i className="ti ti-alert-triangle" />
                      <span>
                        {dConflict && <>Driver also on <b>{dConflict}</b> that day. </>}
                        {bConflict && <>Vehicle also on <b>{bConflict}</b> that day. </>}
                        Fine if they can shuttle — accept to clear.
                      </span>
                    </div>
                    <button onClick={() => updateLeg(leg.id, { conflictOk: true })}>Accept anyway</button>
                  </div>
                ))}
            </div>
            );
          })}

          {addingDriver && (
            <div className="leg" style={{ borderColor: 'var(--green)' }}>
              <div className="leg-head">
                <i className="ti ti-user-plus" /> New driver
              </div>
              <input style={fieldStyle} placeholder="Driver name" value={newDriver} onChange={(e) => setNewDriver(e.target.value)} autoFocus />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="fab" style={{ flex: 1, justifyContent: 'center' }} onClick={saveDriver}>
                  Add to roster
                </button>
                <button className="btn-soft" onClick={() => setAddingDriver(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
        ) : (
          <ReadOnlyTrip w={w} />
        )
      ) : (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">{mayDelegate ? 'Delegate & schedule' : 'Assignment'}</span>
          </div>
          {mayDelegate ? (
            <Field label="Delegate to">
              <Sel value={w.assignee ?? ''} onChange={delegateTo}>
                <option value="">Unassigned…</option>
                {team.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                    {p.deptRole ? ` · ${p.deptRole}` : ''}
                  </option>
                ))}
              </Sel>
            </Field>
          ) : (
            <div className="detail-meta" style={{ marginBottom: 6 }}>
              <i className="ti ti-user-check" />
              {w.assignee ? `Assigned to ${w.assignee}` : 'Not yet assigned'}
            </div>
          )}
          {deptResources.length > 0 &&
            (mayDelegate ? (
              <Field label={w.department === 'IT' ? 'Device / equipment' : 'Equipment'}>
                <Sel value={w.resource ?? ''} onChange={(v) => updateWorkItem(w.id, { resource: v })}>
                  <option value="">None…</option>
                  {deptResources.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Sel>
              </Field>
            ) : (
              w.resource && (
                <div className="detail-meta">
                  <i className="ti ti-package" />
                  {w.resource}
                </div>
              )
            ))}
          {mayDelegate ? (
            <Field label="Scheduled for">
              <input type="date" style={{ ...fieldStyle, appearance: 'auto' }} value={w.scheduledFor ?? ''} onChange={(e) => updateWorkItem(w.id, { scheduledFor: e.target.value, status: w.status === 'Assigned' && e.target.value ? 'Scheduled' : w.status })} />
            </Field>
          ) : (
            w.scheduledFor && (
              <div className="detail-meta">
                <i className="ti ti-calendar" />
                Scheduled for {new Date(w.scheduledFor + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            )
          )}
        </>
      )}

      {w.eventId && (
        <button className="btn-soft" style={{ marginTop: 8 }} onClick={() => nav('/event/' + w.eventId)}>
          <i className="ti ti-calendar" /> View the linked event
        </button>
      )}

      {/* ---- Requester self-service: edit details / withdraw while it's open ---- */}
      {w.requestedBy === user.name && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Your request</span>
          </div>
          {w.withdrawn && (
            <div className="banner" style={{ background: 'var(--warn-tint)', borderColor: 'transparent', color: 'var(--text-2)', marginBottom: 12 }}>
              <i className="ti ti-archive" style={{ color: 'var(--warn)' }} />
              <span>You withdrew this — it's out of the {w.department} queue. Reinstate it anytime; the history is kept.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {w.status !== 'Done' && !w.withdrawn && (
              <button className="btn-soft" onClick={() => { setDraftDetails(w.details ?? ''); setEditing((v) => !v); }}>
                <i className="ti ti-pencil" /> {editing ? 'Cancel edit' : 'Edit details'}
              </button>
            )}
            {w.status !== 'Done' &&
              (w.withdrawn ? (
                <button className="btn-soft" onClick={() => withdrawRequest('work', w.id, false)}>
                  <i className="ti ti-rotate" /> Reinstate request
                </button>
              ) : (
                <button className="btn-soft" onClick={() => { if (confirm('Withdraw this request? It leaves the queue but you can reinstate it anytime.')) withdrawRequest('work', w.id, true); }}>
                  <i className="ti ti-archive" /> Withdraw request
                </button>
              ))}
          </div>
          {editing && !w.withdrawn && (
            <div style={{ marginTop: 12 }}>
              <textarea
                value={draftDetails}
                onChange={(e) => setDraftDetails(e.target.value)}
                rows={3}
                placeholder="Describe the problem or request…"
                style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '0.5px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-1)', padding: 12, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
              />
              <button className="fab" style={{ marginTop: 10, justifyContent: 'center' }} onClick={() => { updateWorkItem(w.id, { details: draftDetails.trim() || undefined }); setEditing(false); }}>
                <i className="ti ti-check" /> Save details
              </button>
            </div>
          )}
        </>
      )}

      <AuditHistory entityId={w.id} />

      <RequestThread
        entityId={w.id}
        link={'#/work/' + w.id}
        title={w.title}
        participants={[w.requestedBy, w.assignee ?? '', ...(w.trip?.legs.map((l) => l.driver ?? '') ?? [])]}
      />

      <div style={{ height: 24 }} />
    </>
  );
}
