import { useMemo, useState } from 'react';
import { roomFolders, resourceFolders } from '../data/inventory';
import { events } from '../lib/data';

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

export default function Spaces() {
  const [tab, setTab] = useState<'rooms' | 'resources'>('rooms');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      for (const r of e.rooms) m.set(r, (m.get(r) || 0) + 1);
      for (const r of e.resources) m.set(r, (m.get(r) || 0) + 1);
    }
    return m;
  }, []);

  const folders = tab === 'rooms' ? roomFolders : resourceFolders;
  const icons = tab === 'rooms' ? roomIcons : resIcons;
  const total = folders.reduce((s, f) => s + f.items.length, 0);

  return (
    <>
      <h1 className="page-h">Spaces</h1>
      <div className="page-sub">{total} bookable {tab} across {folders.length} groups</div>

      <div className="seg" style={{ marginBottom: 22 }}>
        <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>
          Rooms
        </button>
        <button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')}>
          Resources
        </button>
      </div>

      {folders.map((f) => (
        <div className="folder" key={f.name}>
          <div className="folder-h">
            <span className="name">{f.name}</span>
            <span className="count">{f.items.length}</span>
          </div>
          <div className="list">
            {f.items.map((item, i) => (
              <div key={item}>
                {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
                <button className="space-row">
                  <span className="space-ico">
                    <i className={'ti ' + (icons[f.name] || 'ti-point')} />
                  </span>
                  <span className="nm">{item}</span>
                  <span className="meta">
                    {counts.get(item) ? `${counts.get(item)} bookings` : '—'}
                  </span>
                  <i className="ti ti-chevron-right chev" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ height: 12 }} />
    </>
  );
}
