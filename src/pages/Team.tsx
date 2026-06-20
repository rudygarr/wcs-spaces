import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { canDelegate, deptTeam } from '../lib/fulfill';
import type { Department, PersonRec } from '../lib/types';

const DEPTS: { id: Department; icon: string; cls: string }[] = [
  { id: 'Maintenance', icon: 'ti-tool', cls: 't-maint' },
  { id: 'IT', icon: 'ti-device-laptop', cls: 't-it' },
  { id: 'Transportation', icon: 'ti-bus', cls: 't-ath' },
];

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
};

export default function Team() {
  const nav = useNavigate();
  const { user } = useSession();
  const [params] = useSearchParams();
  const only = params.get('dept') as Department | null;

  const manageable = DEPTS.filter((d) => canDelegate(user, d.id)).filter((d) => (only ? d.id === only : true));

  return (
    <>
      <button className="back-link" onClick={() => nav('/queue')}>
        <i className="ti ti-chevron-left" /> Queue
      </button>
      <h1 className="page-h" style={{ marginTop: 6 }}>
        Manage crew
      </h1>
      <div className="page-sub">Add or remove the people each department can delegate work to.</div>

      {manageable.length === 0 && (
        <div className="empty" style={{ marginTop: 20 }}>
          Only a department lead or an administrator can manage a crew.
        </div>
      )}

      {manageable.map((d) => (
        <DeptCrew key={d.id} dept={d.id} icon={d.icon} cls={d.cls} />
      ))}
      <div style={{ height: 24 }} />
    </>
  );
}

function DeptCrew({ dept, icon, cls }: { dept: Department; icon: string; cls: string }) {
  const { db, updatePerson, notify } = useStore();
  const [q, setQ] = useState('');
  const crew = deptTeam(db.people, dept);

  // Staff who could be added: active, not already on this crew.
  const candidates = db.people
    .filter((p) => p.active !== false && p.department !== dept)
    .filter((p) => q.trim() && p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);

  function add(p: PersonRec) {
    updatePerson(p.id, { department: dept, deptRole: 'Tech' });
    notify({ to: p.name, kind: 'crew', title: `You've been added to the ${dept} crew`, body: 'You can now be assigned work in this department.', link: `#/queue?dept=${dept}` });
    setQ('');
  }
  function setRole(p: PersonRec, role: 'Lead' | 'Tech') {
    updatePerson(p.id, { deptRole: role });
  }
  function remove(p: PersonRec) {
    updatePerson(p.id, { department: undefined, deptRole: undefined });
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className={'tile-icon ' + cls} style={{ width: 26, height: 26, borderRadius: 8, fontSize: 14 }}>
            <i className={'ti ' + icon} />
          </span>
          {dept}
        </span>
        <span className="act">{crew.length}</span>
      </div>

      <div className="list">
        {crew.length === 0 && <div className="empty">No crew yet — add someone below.</div>}
        {crew.map((p, i) => (
          <div key={p.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <div className="row" style={{ cursor: 'default' }}>
              <span className="avatar" style={{ flexShrink: 0 }}>
                {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <span className="body">
                <span className="title">{p.name}</span>
                <span className="sub">{p.deptRole}</span>
              </span>
              <span className="seg seg-sm" style={{ marginRight: 8 }}>
                <button className={p.deptRole === 'Lead' ? 'active' : ''} onClick={() => setRole(p, 'Lead')}>
                  Lead
                </button>
                <button className={p.deptRole === 'Tech' ? 'active' : ''} onClick={() => setRole(p, 'Tech')}>
                  Tech
                </button>
              </span>
              <button onClick={() => remove(p)} title="Remove from crew" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>
                <i className="ti ti-user-minus" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <input style={fieldStyle} placeholder={`Add to ${dept} — search staff…`} value={q} onChange={(e) => setQ(e.target.value)} />
        {candidates.length > 0 && (
          <div className="list" style={{ marginTop: 6 }}>
            {candidates.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <button className="row" onClick={() => add(p)}>
                  <span className="avatar" style={{ flexShrink: 0 }}>
                    {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <span className="body">
                    <span className="title">{p.name}</span>
                    {p.department && <span className="sub">Currently {p.department}</span>}
                  </span>
                  <i className="ti ti-plus" style={{ color: 'var(--green)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {dept === 'Transportation' && <DriverRoster />}
    </>
  );
}

function DriverRoster() {
  const { db, addDriver, updateDriver } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const drivers = db.drivers.filter((d) => d.active !== false);

  function save() {
    if (!name.trim()) return;
    addDriver({ name: name.trim(), phone: phone.trim() || undefined });
    setName('');
    setPhone('');
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 20 }}>
        <span className="lbl">Driver roster</span>
        <span className="act">{drivers.length}</span>
      </div>
      <div className="list">
        {drivers.map((d, i) => (
          <div key={d.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <div className="row" style={{ cursor: 'default' }}>
              <span className="avatar" style={{ flexShrink: 0 }}>
                {d.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <span className="body">
                <span className="title">{d.name}</span>
                {d.phone && <span className="sub">{d.phone}</span>}
              </span>
              <button onClick={() => updateDriver(d.id, { active: false })} title="Remove driver" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>
                <i className="ti ti-user-minus" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input style={{ ...fieldStyle, flex: 1.4 }} placeholder="Driver name" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ ...fieldStyle, flex: 1 }} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="fab" style={{ flexShrink: 0, opacity: name.trim() ? 1 : 0.5 }} onClick={save} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </>
  );
}
