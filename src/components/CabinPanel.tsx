import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { initials } from '../lib/session';
import {
  cabinsFor, roomsOfCabin, cabinBeds, cabinOccupants, roomOccupants, cabinLeaders,
  unhousedAttendees, CABIN_KINDS,
} from '../lib/camps';
import type { EventRec, CampCabin, CabinRoom, CabinKind, EventInvite } from '../lib/types';
import Modal, { field, primaryBtn } from './Modal';

const KIND_LABEL: Record<CabinKind, string> = { student: 'Students', staff: 'Staff', parent: 'Parents', guest: 'Guests' };

export default function CabinPanel({ ev }: { ev: EventRec }) {
  const { db, removeCampCabin, removeCabinRoom, assignToCabin, setCabinLeader } = useStore();
  const { user } = useSession();
  const [showAdd, setShowAdd] = useState(false);
  const [assignTo, setAssignTo] = useState<{ cabin: CampCabin; room?: CabinRoom } | null>(null);

  const cabins = cabinsFor(db, ev.id);
  const unhoused = unhousedAttendees(db, ev.id);
  const canManage = user.site_admin || user.resolves_conflicts || ev.owner === user.name;
  if (cabins.length === 0 && !canManage) return null;

  // Group cabins by kind for a clean students/staff/parents/guests layout.
  const byKind = CABIN_KINDS.map((k) => ({ ...k, cabins: cabins.filter((c) => c.kind === k.key) })).filter((g) => g.cabins.length > 0);

  function occupantChip(o: EventInvite) {
    return (
      <span key={o.id} className={'cab-occ' + (o.cabinLeader ? ' leader' : '')} title={o.role}>
        <span className="avatar sm">{initials(o.name)}</span>
        {o.name}{o.cabinLeader && <i className="ti ti-star-filled cab-occ-star" title="Leader" />}
        {canManage && (
          <span className="cab-occ-actions">
            <button title={o.cabinLeader ? 'Unset leader' : 'Make leader'} onClick={() => setCabinLeader(o.id, !o.cabinLeader)}><i className={'ti ' + (o.cabinLeader ? 'ti-star-off' : 'ti-star')} /></button>
            <button title="Remove from cabin" onClick={() => assignToCabin(o.id, undefined)}><i className="ti ti-x" /></button>
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="cab">
      <div className="cbus-head">
        <span className="cbus-title"><i className="ti ti-home" /> Cabins &amp; lodging</span>
        {canManage && <button className="inv-add" onClick={() => setShowAdd(true)}><i className="ti ti-plus" /> Add cabin</button>}
      </div>

      {cabins.length === 0 ? (
        <div className="inv-empty">No cabins yet. Add a cabin with a bed count, or split it into rooms — then house students, staff, parents, and guests.</div>
      ) : (
        byKind.map((g) => (
          <div key={g.key} className="cab-group">
            <div className="cab-group-h"><i className={'ti ' + g.icon} /> {g.label}</div>
            {g.cabins.map((cabin) => {
              const rooms = roomsOfCabin(db, cabin.id);
              const beds = cabinBeds(db, cabin);
              const occ = cabinOccupants(db, cabin.id);
              const leaders = cabinLeaders(db, cabin.id);
              const full = beds > 0 && occ.length >= beds;
              return (
                <div key={cabin.id} className="cab-card">
                  <div className="cbus-card-head">
                    <span className="cbus-name">{cabin.name}</span>
                    <span className={'cbus-fill' + (full ? ' full' : '')}>{occ.length}/{beds || '–'} beds</span>
                    {canManage && <button className="inv-mini" title="Remove cabin" onClick={() => removeCampCabin(cabin.id)}><i className="ti ti-x" /></button>}
                  </div>
                  {leaders.length > 0 && (
                    <div className="cab-leadline"><i className="ti ti-star-filled" /> Led by {leaders.map((l) => l.name).join(', ')}</div>
                  )}

                  {rooms.length > 0 ? (
                    <div className="cab-rooms">
                      {rooms.map((room) => {
                        const ro = roomOccupants(db, room.id);
                        const rFull = ro.length >= room.beds;
                        return (
                          <div key={room.id} className="cab-room">
                            <div className="cab-room-h">
                              <span className="cab-room-name">{room.name}</span>
                              <span className={'cbus-fill' + (rFull ? ' full' : '')}>{ro.length}/{room.beds}</span>
                              {canManage && <button className="inv-mini" title="Remove room" onClick={() => removeCabinRoom(room.id)}><i className="ti ti-x" /></button>}
                            </div>
                            <div className="cab-occs">
                              {ro.map(occupantChip)}
                              {ro.length === 0 && <span className="cbus-empty">Empty</span>}
                            </div>
                            {canManage && <button className="cbus-assign" onClick={() => setAssignTo({ cabin, room })}><i className="ti ti-user-plus" /> Assign to {room.name}</button>}
                          </div>
                        );
                      })}
                      {canManage && <AddRoomInline cabinId={cabin.id} />}
                    </div>
                  ) : (
                    <>
                      <div className="cab-occs">
                        {occ.map(occupantChip)}
                        {occ.length === 0 && <span className="cbus-empty">No one assigned yet</span>}
                      </div>
                      {canManage && (
                        <div className="cab-card-actions">
                          <button className="cbus-assign" onClick={() => setAssignTo({ cabin })}><i className="ti ti-user-plus" /> Assign camper</button>
                          <AddRoomInline cabinId={cabin.id} compact />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {canManage && cabins.length > 0 && unhoused.length > 0 && (
        <div className="cbus-unassigned"><i className="ti ti-bed-off" /> {unhoused.length} attendee{unhoused.length === 1 ? '' : 's'} without a bed yet</div>
      )}

      {showAdd && <AddCabinModal ev={ev} onClose={() => setShowAdd(false)} />}
      {assignTo && <AssignOccupantModal ev={ev} cabin={assignTo.cabin} room={assignTo.room} onClose={() => setAssignTo(null)} />}
    </div>
  );
}

// Inline "add a room within this cabin" affordance.
function AddRoomInline({ cabinId, compact }: { cabinId: string; compact?: boolean }) {
  const { addCabinRoom } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [beds, setBeds] = useState('');
  if (!open) return <button className={'cab-addroom' + (compact ? ' compact' : '')} onClick={() => setOpen(true)}><i className="ti ti-plus" /> Add a room</button>;
  return (
    <div className="cab-addroom-form">
      <input style={{ ...field, height: 36 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" autoFocus />
      <input style={{ ...field, height: 36, width: 70 }} type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="beds" />
      <button className="btn-soft sm" disabled={!name.trim() || !beds} onClick={() => { addCabinRoom(cabinId, { name: name.trim(), beds: Number(beds) }); setName(''); setBeds(''); setOpen(false); }}>Add</button>
      <button className="inv-mini" onClick={() => setOpen(false)}><i className="ti ti-x" /></button>
    </div>
  );
}

function AddCabinModal({ ev, onClose }: { ev: EventRec; onClose: () => void }) {
  const { addCampCabin } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CabinKind>('student');
  const [beds, setBeds] = useState('');
  return (
    <Modal title="Add a cabin" onClose={onClose}>
      <label className="vis-label">Cabin name<input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Pine Lodge" autoFocus /></label>
      <label className="vis-label">Who stays here
        <select style={{ ...field, appearance: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as CabinKind)}>
          {CABIN_KINDS.map((k) => <option key={k.key} value={k.key}>{KIND_LABEL[k.key]}</option>)}
        </select>
      </label>
      <label className="vis-label">Total beds (optional — or add rooms-within after)
        <input style={field} type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="e.g. 16" />
      </label>
      <div className="inv-note"><i className="ti ti-info-circle" /> Leave beds blank if you'll split the cabin into rooms; each room carries its own bed count.</div>
      <button style={{ ...primaryBtn, marginTop: 12, opacity: name.trim() ? 1 : 0.5 }} disabled={!name.trim()} onClick={() => { addCampCabin(ev.id, { name: name.trim(), kind, beds: beds ? Number(beds) : undefined }); onClose(); }}>Add cabin</button>
    </Modal>
  );
}

function AssignOccupantModal({ ev, cabin, room, onClose }: { ev: EventRec; cabin: CampCabin; room?: CabinRoom; onClose: () => void }) {
  const { db, inviteToEvent, assignToCabin, setCabinLeader } = useStore();
  const [q, setQ] = useState('');
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [asLeader, setAsLeader] = useState(false);

  const unhoused = unhousedAttendees(db, ev.id).filter((c) => q.trim() === '' || c.name.toLowerCase().includes(q.toLowerCase()));
  const people = db.people
    .filter((p) => p.active !== false)
    .filter((p) => q.trim() !== '' && p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  const target = room ? `${cabin.name} · ${room.name}` : cabin.name;

  return (
    <Modal title={`Assign to ${target}`} onClose={onClose}>
      <label className="cab-leadtoggle">
        <input type="checkbox" checked={asLeader} onChange={(e) => setAsLeader(e.target.checked)} />
        <i className="ti ti-star" /> Assign as a leader (in charge here)
      </label>

      <label className="vis-label" style={{ marginTop: 12 }}>Search<input style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search attendees & people…" autoFocus /></label>

      {unhoused.length > 0 && (
        <>
          <div className="cbus-pick-label">Invited, no bed yet</div>
          <div className="inv-pick">
            {unhoused.map((c) => (
              <button key={c.id} className="inv-pick-row" onClick={() => { assignToCabin(c.id, cabin.id, room?.id); if (asLeader) setCabinLeader(c.id, true); }}>
                <span className="avatar sm">{initials(c.name)}</span><span className="inv-pick-name">{c.name}</span><i className="ti ti-arrow-right" />
              </button>
            ))}
          </div>
        </>
      )}

      {people.length > 0 && (
        <>
          <div className="cbus-pick-label">Add someone with an account</div>
          <div className="inv-pick">
            {people.map((p) => (
              <button key={p.id} className="inv-pick-row" onClick={() => { inviteToEvent(ev.id, { personId: p.id, name: p.name, role: asLeader ? 'Cabin Leader' : 'Camper', cabinId: cabin.id, cabinRoomId: room?.id, cabinLeader: asLeader }); setQ(''); }}>
                <span className="avatar sm">{initials(p.name)}</span><span className="inv-pick-name">{p.name}</span><i className="ti ti-plus" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="inv-divider"><span>or add by name &amp; email — no account</span></div>
      <div className="inv-ext">
        <input style={field} value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Name" />
        <input style={field} type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="email@example.com" />
        <button style={{ ...primaryBtn, height: 42, opacity: extName.trim() && extEmail.trim() ? 1 : 0.5 }} disabled={!extName.trim() || !extEmail.trim()}
          onClick={() => { inviteToEvent(ev.id, { name: extName.trim(), email: extEmail.trim(), role: asLeader ? 'Cabin Leader' : 'Camper', cabinId: cabin.id, cabinRoomId: room?.id, cabinLeader: asLeader }); setExtName(''); setExtEmail(''); }}>
          Add to {room ? room.name : cabin.name}
        </button>
      </div>
    </Modal>
  );
}
