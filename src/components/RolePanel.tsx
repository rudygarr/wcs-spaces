import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { initials } from '../lib/session';
import { rolesFor, shiftsOfRole, dutiesOfRole, dutiesOfShift, unscheduledDuties, shiftWindow } from '../lib/camps';
import type { EventRec, CampRole, CampShift, CampDuty } from '../lib/types';
import Modal, { field, primaryBtn } from './Modal';

const ROLE_ICONS = ['ti-broadcast', 'ti-bus', 'ti-tools', 'ti-shield-half', 'ti-heartbeat', 'ti-cookie', 'ti-swimming', 'ti-checkup-list', 'ti-campfire', 'ti-friends'];

export default function RolePanel({ ev }: { ev: EventRec }) {
  const { db, removeCampRole, removeCampShift, removeDuty } = useStore();
  const { user } = useSession();
  const [showAdd, setShowAdd] = useState(false);
  const [assign, setAssign] = useState<{ role: CampRole; shift?: CampShift } | null>(null);
  const [addShiftTo, setAddShiftTo] = useState<CampRole | null>(null);

  const roles = rolesFor(db, ev.id);
  const canManage = user.site_admin || user.resolves_conflicts || ev.owner === user.name;
  if (roles.length === 0 && !canManage) return null;

  function dutyChip(d: CampDuty) {
    return (
      <span key={d.id} className="cab-occ">
        <span className="avatar sm">{initials(d.name)}</span>{d.name}
        {canManage && <span className="cab-occ-actions"><button title="Remove" onClick={() => removeDuty(d.id)}><i className="ti ti-x" /></button></span>}
      </span>
    );
  }

  return (
    <div className="rp">
      <div className="cbus-head">
        <span className="cbus-title"><i className="ti ti-clipboard-check" /> Camp roles</span>
        {canManage && <button className="inv-add" onClick={() => setShowAdd(true)}><i className="ti ti-plus" /> Add role</button>}
      </div>

      {roles.length === 0 ? (
        <div className="inv-empty">No roles yet. Create roles for the adults — production, monitors, kitchen, security, nurse, lifeguards — and split any into shifts.</div>
      ) : (
        <div className="rp-list">
          {roles.map((role) => {
            const shifts = shiftsOfRole(db, role.id);
            const all = dutiesOfRole(db, role.id);
            const loose = unscheduledDuties(db, role.id);
            return (
              <div key={role.id} className="rp-card">
                <div className="rp-card-head">
                  <span className="rp-ic"><i className={'ti ' + (role.icon ?? 'ti-checkup-list')} /></span>
                  <span className="rp-name">{role.name}<span className="rp-count">{all.length} assigned</span></span>
                  {canManage && <button className="inv-mini" title="Remove role" onClick={() => removeCampRole(role.id)}><i className="ti ti-x" /></button>}
                </div>
                {role.blurb && <div className="rp-blurb">{role.blurb}</div>}

                {shifts.length > 0 ? (
                  <div className="rp-shifts">
                    {shifts.map((s) => {
                      const ds = dutiesOfShift(db, s.id);
                      return (
                        <div key={s.id} className="rp-shift">
                          <div className="rp-shift-h">
                            <span className="rp-shift-name">{s.name}{shiftWindow(s) && <span className="rp-shift-time">{shiftWindow(s)}</span>}</span>
                            <span className={'cbus-fill' + (ds.length === 0 ? ' full' : '')}>{ds.length === 0 ? 'unfilled' : `${ds.length} on`}</span>
                            {canManage && <button className="inv-mini" title="Remove shift" onClick={() => removeCampShift(s.id)}><i className="ti ti-x" /></button>}
                          </div>
                          <div className="cab-occs">
                            {ds.map(dutyChip)}
                            {ds.length === 0 && <span className="cbus-empty">No one yet</span>}
                          </div>
                          {canManage && <button className="cbus-assign" onClick={() => setAssign({ role, shift: s })}><i className="ti ti-user-plus" /> Assign to {s.name}</button>}
                        </div>
                      );
                    })}
                    {canManage && <button className="cab-addroom" onClick={() => setAddShiftTo(role)}><i className="ti ti-plus" /> Add a shift</button>}
                  </div>
                ) : (
                  <>
                    <div className="cab-occs">
                      {loose.map(dutyChip)}
                      {loose.length === 0 && <span className="cbus-empty">No one assigned yet</span>}
                    </div>
                    {canManage && (
                      <div className="cab-card-actions">
                        <button className="cbus-assign" onClick={() => setAssign({ role })}><i className="ti ti-user-plus" /> Assign</button>
                        <button className="cab-addroom compact" onClick={() => setAddShiftTo(role)}><i className="ti ti-clock-plus" /> Split into shifts</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddRoleModal ev={ev} onClose={() => setShowAdd(false)} />}
      {addShiftTo && <AddShiftModal role={addShiftTo} onClose={() => setAddShiftTo(null)} />}
      {assign && <AssignDutyModal ev={ev} role={assign.role} shift={assign.shift} onClose={() => setAssign(null)} />}
    </div>
  );
}

function AddRoleModal({ ev, onClose }: { ev: EventRec; onClose: () => void }) {
  const { addCampRole } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ROLE_ICONS[0]);
  const [blurb, setBlurb] = useState('');
  return (
    <Modal title="Add a camp role" onClose={onClose}>
      <label className="vis-label">Role name<input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lifeguard, Kitchen Helper, Security…" autoFocus /></label>
      <label className="vis-label">Icon</label>
      <div className="rp-iconpick">
        {ROLE_ICONS.map((ic) => (
          <button key={ic} className={'rp-iconbtn' + (icon === ic ? ' on' : '')} onClick={() => setIcon(ic)}><i className={'ti ' + ic} /></button>
        ))}
      </div>
      <label className="vis-label" style={{ marginTop: 12 }}>Description (optional)<input style={field} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="What this role covers" /></label>
      <div className="inv-note"><i className="ti ti-info-circle" /> Add the role first, then split it into shifts if it needs coverage across the day.</div>
      <button style={{ ...primaryBtn, marginTop: 12, opacity: name.trim() ? 1 : 0.5 }} disabled={!name.trim()} onClick={() => { addCampRole(ev.id, { name: name.trim(), icon, blurb: blurb.trim() || undefined }); onClose(); }}>Add role</button>
    </Modal>
  );
}

function AddShiftModal({ role, onClose }: { role: CampRole; onClose: () => void }) {
  const { addCampShift } = useStore();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  return (
    <Modal title={`Add a shift — ${role.name}`} onClose={onClose}>
      <label className="vis-label">Shift name<input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Breakfast, Departure, Overnight…" autoFocus /></label>
      <div className="vis-row">
        <label className="vis-label" style={{ flex: 1 }}>Start (optional)<input type="time" style={{ ...field, appearance: 'auto' }} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="vis-label" style={{ flex: 1 }}>End (optional)<input type="time" style={{ ...field, appearance: 'auto' }} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <button style={{ ...primaryBtn, marginTop: 8, opacity: name.trim() ? 1 : 0.5 }} disabled={!name.trim()} onClick={() => { addCampShift(role.id, { name: name.trim(), start: start || undefined, end: end || undefined }); onClose(); }}>Add shift</button>
    </Modal>
  );
}

function AssignDutyModal({ ev, role, shift, onClose }: { ev: EventRec; role: CampRole; shift?: CampShift; onClose: () => void }) {
  const { db, assignDuty } = useStore();
  const [q, setQ] = useState('');
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const people = db.people
    .filter((p) => p.active !== false)
    .filter((p) => q.trim() !== '' && p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  const target = shift ? `${role.name} · ${shift.name}` : role.name;
  return (
    <Modal title={`Assign — ${target}`} onClose={onClose}>
      <label className="vis-label">Search people<input style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff & volunteers…" autoFocus /></label>
      <div className="inv-pick">
        {people.map((p) => (
          <button key={p.id} className="inv-pick-row" onClick={() => { assignDuty(ev.id, role.id, { personId: p.id, name: p.name, shiftId: shift?.id }); setQ(''); }}>
            <span className="avatar sm">{initials(p.name)}</span><span className="inv-pick-name">{p.name}</span><i className="ti ti-plus" />
          </button>
        ))}
        {q.trim() !== '' && people.length === 0 && <div className="inv-empty" style={{ margin: 0 }}>No matches.</div>}
      </div>
      <div className="inv-divider"><span>or add a helper by name &amp; email</span></div>
      <div className="inv-ext">
        <input style={field} value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Name" />
        <input style={field} type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="email@example.com (optional)" />
        <button style={{ ...primaryBtn, height: 42, opacity: extName.trim() ? 1 : 0.5 }} disabled={!extName.trim()}
          onClick={() => { assignDuty(ev.id, role.id, { name: extName.trim(), email: extEmail.trim() || undefined, shiftId: shift?.id }); setExtName(''); setExtEmail(''); }}>
          Assign
        </button>
      </div>
    </Modal>
  );
}
