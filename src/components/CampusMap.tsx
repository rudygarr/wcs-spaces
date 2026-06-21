import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, groupByFolder } from '../lib/store';
import { roomHasConflict } from '../lib/conflicts';
import { eventsOnDay, DEMO_TODAY } from '../lib/data';

const buildingIcons: Record<string, string> = {
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

// A schematic campus map: each building (folder) is a zone, each room a tile
// tinted by today's state — free, in use, or contested. Skedda's signature
// "see the space, click to book" reflex, without real architectural plans.
export function CampusMap() {
  const nav = useNavigate();
  const { db } = useStore();

  // Bookings happening today, per room — drives the tile color.
  const todayByRoom = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventsOnDay(db.events, DEMO_TODAY)) {
      for (const r of e.rooms) m.set(r, (m.get(r) || 0) + 1);
    }
    return m;
  }, [db.events]);

  const groups = useMemo(() => groupByFolder(db.rooms), [db.rooms]);

  return (
    <div>
      <div className="map-legend">
        <span><span className="map-key free" /> Free today</span>
        <span><span className="map-key busy" /> In use</span>
        <span><span className="map-key hot" /> Contested</span>
      </div>

      <div className="campus">
        {groups.map((b) => (
          <div className="bldg" key={b.name}>
            <div className="bldg-h">
              <i className={'ti ' + (buildingIcons[b.name] || 'ti-building')} />
              <span>{b.name}</span>
            </div>
            <div className="bldg-rooms">
              {b.items.map((room) => {
                const hot = roomHasConflict(db, room.name);
                const busy = (todayByRoom.get(room.name) || 0) > 0;
                const cls = hot ? 'hot' : busy ? 'busy' : 'free';
                return (
                  <button
                    key={room.id}
                    className={'rtile ' + cls}
                    onClick={() => nav('/room/' + room.id)}
                    title={hot ? 'Contested — double-booked' : busy ? `${todayByRoom.get(room.name)} today` : 'Free today'}
                  >
                    {hot && <i className="ti ti-alert-triangle rtile-flag" />}
                    <span className="rtile-name">{room.name}</span>
                    {busy && !hot && <span className="rtile-cnt">{todayByRoom.get(room.name)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
