import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { initials } from '../lib/session';
import { busesFor, rosterOf, unassignedCampers, busLabel } from '../lib/camps';
import type { EventRec, CampBus } from '../lib/types';
import Modal, { field, primaryBtn } from './Modal';

export default function CampBusPanel({ ev }: { ev: EventRec }) {
  const { db, removeCampBus, assignToBus } = useStore();
  const { user } = useSession();
  const [showAdd, setShowAdd] = useState(false);
  const [assignTo, setAssignTo] = useState<CampBus | null>(null);

  const buses = busesFor(db, ev.id);
  const unassigned = unassignedCampers(db, ev.id);
  const canManage = user.site_admin || user.resolves_conflicts || ev.owner === user.name;

  // Zero-footprint unless this is a camp with buses (or you can add them).
  if (buses.length === 0 && !canManage) return null;

  return (
    <div className="cbus">
      <div className="cbus-head">
        <span className="cbus-title"><i className="ti ti-bus" /> Camp buses <span className="cbus-rental">rental</span></span>
        {canManage && <button className="inv-add" onClick={() => setShowAdd(true)}><i className="ti ti-plus" /> Charter a bus</button>}
      </div>

      {buses.length === 0 ? (
        <div className="inv-empty">No buses yet. Charter a rental bus and assign campers so each kid knows which bus is theirs.</div>
      ) : (
        <div className="cbus-grid">
          {buses.map((bus) => {
            const roster = rosterOf(db, bus.id);
            const full = bus.capacity ? roster.length >= bus.capacity : false;
            return (
              <div key={bus.id} className="cbus-card">
                <div className="cbus-card-head">
                  <span className="cbus-name">{busLabel(bus)}</span>
                  <span className={'cbus-fill' + (full ? ' full' : '')}>{roster.length}{bus.capacity ? `/${bus.capacity}` : ''}</span>
                  {canManage && <button className="inv-mini" title="Remove bus" onClick={() => removeCampBus(bus.id)}><i className="ti ti-x" /></button>}
                </div>
                {(bus.rentalOrg || bus.departInfo) && (
                  <div className="cbus-meta">
                    {bus.rentalOrg && <span><i className="ti ti-building-store" /> {bus.rentalOrg}</span>}
                    {bus.departInfo && <span><i className="ti ti-clock" /> {bus.departInfo}</span>}
                  </div>
                )}
                <div className="cbus-roster">
                  {roster.map((c) => (
                    <span key={c.id} className="cbus-camper" title={c.status}>
                      <span className="avatar sm">{initials(c.name)}</span>{c.name.split(' ')[0]}
                      {canManage && <button className="cbus-camper-x" title="Remove from bus" onClick={() => assignToBus(c.id, undefined)}><i className="ti ti-x" /></button>}
                    </span>
                  ))}
                  {roster.length === 0 && <span className="cbus-empty">No campers yet</span>}
                </div>
                {canManage && <button className="cbus-assign" onClick={() => setAssignTo(bus)}><i className="ti ti-user-plus" /> Add camper</button>}
              </div>
            );
          })}
        </div>
      )}

      {canManage && unassigned.length > 0 && (
        <div className="cbus-unassigned">
          <i className="ti ti-alert-circle" /> {unassigned.length} invited camper{unassigned.length === 1 ? '' : 's'} not on a bus yet
          {buses.length > 0 && ' — use “Add camper” on a bus.'}
        </div>
      )}

      {showAdd && <AddBusModal ev={ev} onClose={() => setShowAdd(false)} />}
      {assignTo && <AssignCamperModal ev={ev} bus={assignTo} onClose={() => setAssignTo(null)} />}
    </div>
  );
}

function AddBusModal({ ev, onClose }: { ev: EventRec; onClose: () => void }) {
  const { addCampBus } = useStore();
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [cap, setCap] = useState('');
  const [org, setOrg] = useState('');
  const [depart, setDepart] = useState('');
  function save() {
    if (!name.trim()) return;
    addCampBus(ev.id, { name: name.trim(), label: label.trim() || undefined, capacity: cap ? Number(cap) : undefined, rentalOrg: org.trim() || undefined, departInfo: depart.trim() || undefined });
    onClose();
  }
  return (
    <Modal title="Charter a rental bus" onClose={onClose}>
      <div className="inv-note" style={{ marginBottom: 12 }}><i className="ti ti-info-circle" /> A chartered bus, not the school’s fleet. It’s added as a rental room you can assign campers to.</div>
      <label className="vis-label">Bus name<input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bus 1" autoFocus /></label>
      <label className="vis-label">Crew / theme (optional)<input style={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Coral Crew" /></label>
      <div className="vis-row">
        <label className="vis-label" style={{ flex: 1 }}>Capacity<input style={field} type="number" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="24" /></label>
        <label className="vis-label" style={{ flex: 2 }}>Charter company<input style={field} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Sunshine Charters" /></label>
      </div>
      <label className="vis-label">Departure (optional)<input style={field} value={depart} onChange={(e) => setDepart(e.target.value)} placeholder="Departs 7:30 AM · Main Lot" /></label>
      <button style={{ ...primaryBtn, marginTop: 8, opacity: name.trim() ? 1 : 0.5 }} disabled={!name.trim()} onClick={save}>Add bus</button>
    </Modal>
  );
}

function AssignCamperModal({ ev, bus, onClose }: { ev: EventRec; bus: CampBus; onClose: () => void }) {
  const { db, inviteToEvent, assignToBus } = useStore();
  const [q, setQ] = useState('');
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');

  // Already-invited campers not yet on a bus → quick-assign; plus invite new.
  const unassigned = unassignedCampers(db, ev.id).filter((c) => q.trim() === '' || c.name.toLowerCase().includes(q.toLowerCase()));
  const onBus = new Set(rosterOf(db, bus.id).map((r) => r.personId).filter(Boolean));
  const people = db.people
    .filter((p) => p.active !== false && !onBus.has(p.id))
    .filter((p) => q.trim() !== '' && p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);

  return (
    <Modal title={`Add camper to ${busLabel(bus)}`} onClose={onClose}>
      <label className="vis-label">Search<input style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campers & students…" autoFocus /></label>

      {unassigned.length > 0 && (
        <>
          <div className="cbus-pick-label">Invited, not on a bus</div>
          <div className="inv-pick">
            {unassigned.map((c) => (
              <button key={c.id} className="inv-pick-row" onClick={() => { assignToBus(c.id, bus.id); }}>
                <span className="avatar sm">{initials(c.name)}</span><span className="inv-pick-name">{c.name}</span><i className="ti ti-arrow-right" />
              </button>
            ))}
          </div>
        </>
      )}

      {people.length > 0 && (
        <>
          <div className="cbus-pick-label">Invite &amp; assign someone with an account</div>
          <div className="inv-pick">
            {people.map((p) => (
              <button key={p.id} className="inv-pick-row" onClick={() => { inviteToEvent(ev.id, { personId: p.id, name: p.name, role: 'Camper', busId: bus.id }); setQ(''); }}>
                <span className="avatar sm">{initials(p.name)}</span><span className="inv-pick-name">{p.name}</span><i className="ti ti-plus" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="inv-divider"><span>or add a camper by email — no account</span></div>
      <div className="inv-ext">
        <input style={field} value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Camper name" />
        <input style={field} type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="parent@example.com" />
        <button style={{ ...primaryBtn, height: 42, opacity: extName.trim() && extEmail.trim() ? 1 : 0.5 }} disabled={!extName.trim() || !extEmail.trim()}
          onClick={() => { inviteToEvent(ev.id, { name: extName.trim(), email: extEmail.trim(), role: 'Camper', busId: bus.id }); setExtName(''); setExtEmail(''); }}>
          Add to {bus.name}
        </button>
      </div>
    </Modal>
  );
}
