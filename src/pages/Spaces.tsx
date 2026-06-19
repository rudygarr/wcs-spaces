import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, groupByFolder } from '../lib/store';
import { initials, roleLabel } from '../lib/session';
import Modal, { field, primaryBtn } from '../components/Modal';

type Tab = 'rooms' | 'resources' | 'people';

const roomIcons: Record<string, string> = {
  Athletics: 'ti-ball-basketball',
  'Wild Acre': 'ti-trees',
  'Nature Center': 'ti-leaf',
  'Lighthouse PAC': 'ti-masks-theater',
  'The Beacon': 'ti-music',
  'Fine Arts': 'ti-palette',
  'Elementary School': 'ti-school',
  'Middle School': 'ti-school',
  'High School': 'ti-school',
  'Media Center': 'ti-books',
  Administration: 'ti-briefcase',
};
const resIcons: Record<string, string> = {
  Maintenance: 'ti-tool',
  'Sound/Lights/Staging': 'ti-microphone',
  IT: 'ti-device-laptop',
  Transportation: 'ti-bus',
  'Custodial/Cleaning': 'ti-spray',
  Catering: 'ti-tools-kitchen-2',
  Administration: 'ti-shield',
};

function AddSpace({ kind, folders, onClose }: { kind: 'rooms' | 'resources'; folders: string[]; onClose: () => void }) {
  const { addRoom, addResource } = useStore();
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(folders[0] ?? '');
  const label = kind === 'rooms' ? 'room' : 'resource';
  function submit() {
    if (!name.trim() || !folder.trim()) return;
    if (kind === 'rooms') addRoom(name, folder.trim());
    else addResource(name, folder.trim());
    onClose();
  }
  return (
    <Modal title={`Add ${label}`} onClose={onClose}>
      <label className="flabel">{label[0].toUpperCase() + label.slice(1)} name</label>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={kind === 'rooms' ? 'Room 204' : 'Projector cart'} />
      <label className="flabel">Group</label>
      <input style={field} list="folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Pick or type a new group" />
      <datalist id="folders">
        {folders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <button style={{ ...primaryBtn, marginTop: 18 }} onClick={submit}>
        Add {label}
      </button>
    </Modal>
  );
}

export default function Spaces() {
  const nav = useNavigate();
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>('rooms');
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of db.events) {
      for (const r of e.rooms) m.set(r, (m.get(r) || 0) + 1);
      for (const r of e.resources) m.set(r, (m.get(r) || 0) + 1);
    }
    return m;
  }, [db.events]);

  const roomGroups = useMemo(() => groupByFolder(db.rooms), [db.rooms]);
  const resGroups = useMemo(() => groupByFolder(db.resources), [db.resources]);

  return (
    <>
      <h1 className="page-h">Spaces</h1>
      <div className="page-sub">
        {tab === 'people'
          ? `${db.people.length} staff with access`
          : `${(tab === 'rooms' ? db.rooms : db.resources).length} bookable ${tab}`}
      </div>

      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>
          Rooms
        </button>
        <button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')}>
          Resources
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          People
        </button>
      </div>

      {tab !== 'people' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn-soft" onClick={() => setAdding(true)}>
            <i className="ti ti-plus" /> Add {tab === 'rooms' ? 'room' : 'resource'}
          </button>
        </div>
      )}

      {tab === 'people' && (
        <div className="list">
          {[...db.people]
            .sort((a, b) => (a.site_admin === b.site_admin ? a.name.localeCompare(b.name) : a.site_admin ? -1 : 1))
            .map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
                <div className="space-row" style={{ cursor: 'default' }}>
                  <span className="avatar" style={{ width: 34, height: 34 }}>
                    {initials(p.name)}
                  </span>
                  <span className="nm">{p.name}</span>
                  <span className="meta">
                    {roleLabel(p)}
                    {p.resolves_conflicts ? ' · resolver' : ''}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab !== 'people' &&
        (tab === 'rooms' ? roomGroups : resGroups).map((f) => {
          const icons = tab === 'rooms' ? roomIcons : resIcons;
          return (
            <div className="folder" key={f.name}>
              <div className="folder-h">
                <span className="name">{f.name}</span>
                <span className="count">{f.items.length}</span>
              </div>
              <div className="list">
                {f.items.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
                    <button
                      className="space-row"
                      onClick={() => tab === 'rooms' && nav('/room/' + item.id)}
                      style={tab === 'resources' ? { cursor: 'default' } : undefined}
                    >
                      <span className="space-ico">
                        <i className={'ti ' + (icons[f.name] || 'ti-point')} />
                      </span>
                      <span className="nm">{item.name}</span>
                      <span className="meta">{counts.get(item.name) ? `${counts.get(item.name)} bookings` : '—'}</span>
                      {tab === 'rooms' && <i className="ti ti-chevron-right chev" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      <div style={{ height: 12 }} />

      {adding && tab !== 'people' && (
        <AddSpace
          kind={tab}
          folders={(tab === 'rooms' ? roomGroups : resGroups).map((g) => g.name)}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
