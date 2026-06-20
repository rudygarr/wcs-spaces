import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { SetupDiagram, setupStyleName } from '../components/SetupDiagram';
import { statusTint, priorityColor } from './Queue';
import type { TripLeg, WorkStatus } from '../lib/types';

const STATUSES: WorkStatus[] = ['New', 'Assigned', 'Scheduled', 'In progress', 'Done'];

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

export default function WorkDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateWorkItem, addDriver } = useStore();
  const w = db.workItems.find((x) => x.id === id);
  const [addingDriver, setAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState('');

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

  const staff = [...db.people].filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const drivers = db.drivers.filter((d) => d.active !== false);
  const buses = db.resources.filter((r) => r.folder === 'Transportation').map((r) => r.name);

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
  }
  function updateLeg(legId: string, patch: Partial<TripLeg>) {
    if (!w!.trip) return;
    const legs = w!.trip.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l));
    updateWorkItem(w!.id, { trip: { ...w!.trip, legs } });
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

      {/* ---- Status pipeline ---- */}
      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Status</span>
      </div>
      <div className="statusbar">
        {STATUSES.map((s) => (
          <button key={s} className={'statusstep' + (w.status === s ? ' on' : '')} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* ---- Transportation dispatch ---- */}
      {isTransport ? (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Trip — assign a bus &amp; driver per leg</span>
          </div>
          <Field label="Scheduled date">
            <input type="date" style={{ ...fieldStyle, appearance: 'auto' }} value={w.scheduledFor ?? ''} onChange={(e) => updateWorkItem(w.id, { scheduledFor: e.target.value })} />
          </Field>
          {w.trip!.legs.map((leg) => (
            <div key={leg.id} className="leg">
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
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 5 }}>Driver</div>
                  <Sel value={leg.driver ?? ''} onChange={(v) => (v === '__add' ? setAddingDriver(true) : updateLeg(leg.id, { driver: v }))}>
                    <option value="">Pick driver…</option>
                    {drivers.map((d) => (
                      <option key={d.id}>{d.name}</option>
                    ))}
                    <option value="__add">+ Add a driver…</option>
                  </Sel>
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
                {leg.bus && busInUse(leg.bus, leg.id) && (
                  <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 5 }}>
                    <i className="ti ti-alert-triangle" /> This vehicle is already booked elsewhere that day.
                  </div>
                )}
              </div>
            </div>
          ))}

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
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Assign &amp; schedule</span>
          </div>
          <Field label="Assigned to">
            <Sel value={w.assignee ?? ''} onChange={(v) => updateWorkItem(w.id, { assignee: v, status: w.status === 'New' && v ? 'Assigned' : w.status })}>
              <option value="">Unassigned…</option>
              {staff.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </Sel>
          </Field>
          <Field label="Scheduled for">
            <input type="date" style={{ ...fieldStyle, appearance: 'auto' }} value={w.scheduledFor ?? ''} onChange={(e) => updateWorkItem(w.id, { scheduledFor: e.target.value, status: w.status === 'Assigned' && e.target.value ? 'Scheduled' : w.status })} />
          </Field>
        </>
      )}

      {w.eventId && (
        <button className="btn-soft" style={{ marginTop: 8 }} onClick={() => nav('/event/' + w.eventId)}>
          <i className="ti ti-calendar" /> View the linked event
        </button>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
