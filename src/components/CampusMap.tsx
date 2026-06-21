import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, groupByFolder } from '../lib/store';
import { roomHasConflict } from '../lib/conflicts';
import { eventsOnDay, DEMO_TODAY } from '../lib/data';
import { pmStatus, PM_META } from '../lib/assets';
import { openWorkByZone, assetsByZone, workPinColor, OFF_ZONE } from '../lib/mapPins';

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

type Layer = 'spaces' | 'work' | 'assets';

// A schematic campus map: each building (folder) is a zone. Three layers paint
// the same canvas — Spaces (room state today), Work (open orders pinned to where
// they are), and Assets (equipment with PM-due flags). Skedda's "see the space"
// reflex extended to FMX's "see the work on a map," without real architectural plans.
export function CampusMap() {
  const nav = useNavigate();
  const { db } = useStore();
  const [layer, setLayer] = useState<Layer>('spaces');

  // Bookings happening today, per room — drives the Spaces tile color.
  const todayByRoom = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventsOnDay(db.events, DEMO_TODAY)) {
      for (const r of e.rooms) m.set(r, (m.get(r) || 0) + 1);
    }
    return m;
  }, [db.events]);

  const groups = useMemo(() => groupByFolder(db.rooms), [db.rooms]);
  const workZones = useMemo(() => openWorkByZone(db), [db]);
  const assetZones = useMemo(() => assetsByZone(db), [db]);

  // Building order for overlay layers, plus the catch-all off-site zone at the end.
  const zoneNames = useMemo(() => {
    const names = groups.map((g) => g.name);
    return [...names, OFF_ZONE];
  }, [groups]);

  const workTotal = useMemo(() => [...workZones.values()].reduce((s, l) => s + l.length, 0), [workZones]);
  const assetTotal = useMemo(() => [...assetZones.values()].reduce((s, l) => s + l.length, 0), [assetZones]);

  return (
    <div>
      <div className="seg seg-sm map-layers">
        <button className={layer === 'spaces' ? 'active' : ''} onClick={() => setLayer('spaces')}>
          <i className="ti ti-door" /> Spaces
        </button>
        <button className={layer === 'work' ? 'active' : ''} onClick={() => setLayer('work')}>
          <i className="ti ti-tool" /> Work {workTotal > 0 && <span className="layer-badge">{workTotal}</span>}
        </button>
        <button className={layer === 'assets' ? 'active' : ''} onClick={() => setLayer('assets')}>
          <i className="ti ti-qrcode" /> Assets {assetTotal > 0 && <span className="layer-badge">{assetTotal}</span>}
        </button>
      </div>

      {layer === 'spaces' && (
        <div className="map-legend">
          <span><span className="map-key free" /> Free today</span>
          <span><span className="map-key busy" /> In use</span>
          <span><span className="map-key hot" /> Contested</span>
        </div>
      )}
      {layer === 'work' && (
        <div className="map-legend">
          <span><span className="map-key" style={{ background: 'var(--bad)' }} /> Urgent</span>
          <span><span className="map-key" style={{ background: 'var(--gold)' }} /> New</span>
          <span><span className="map-key" style={{ background: 'var(--info)' }} /> Assigned</span>
          <span><span className="map-key" style={{ background: 'var(--green)' }} /> In progress</span>
        </div>
      )}
      {layer === 'assets' && (
        <div className="map-legend">
          <span><span className="map-key" style={{ background: 'var(--bad)' }} /> PM overdue</span>
          <span><span className="map-key" style={{ background: 'var(--warn)' }} /> Due soon</span>
          <span><span className="map-key" style={{ background: 'var(--text-3)' }} /> OK</span>
        </div>
      )}

      {layer === 'spaces' && (
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
      )}

      {layer === 'work' && (
        <div className="campus">
          {zoneNames.map((zone) => {
            const items = workZones.get(zone) ?? [];
            if (items.length === 0) return null;
            const offsite = zone === OFF_ZONE;
            return (
              <div className="bldg" key={zone}>
                <div className="bldg-h">
                  <i className={'ti ' + (offsite ? 'ti-map-pin' : buildingIcons[zone] || 'ti-building')} />
                  <span>{zone}</span>
                  <span className="bldg-cnt">{items.length}</span>
                </div>
                <div className="pin-list">
                  {items.map((w) => (
                    <button key={w.id} className="pin" onClick={() => nav('/work/' + w.id)}>
                      <span className="pin-dot" style={{ background: workPinColor(w) }} />
                      <span className="pin-body">
                        <span className="pin-title">{w.title}</span>
                        <span className="pin-sub">
                          {w.department} · {w.status}
                          {w.location ? ' · ' + w.location : ''}
                        </span>
                      </span>
                      {w.priority === 'Urgent' && <i className="ti ti-flame" style={{ color: 'var(--bad)' }} />}
                    </button>
                  ))}
                </div>
                {!offsite && (
                  <button className="pin-add" onClick={() => nav('/requests?door=maintenance&loc=' + encodeURIComponent(zone))}>
                    <i className="ti ti-plus" /> Report here
                  </button>
                )}
              </div>
            );
          })}
          {workTotal === 0 && <div className="empty">No open work orders to map.</div>}
        </div>
      )}

      {layer === 'assets' && (
        <div className="campus">
          {zoneNames.map((zone) => {
            const items = assetZones.get(zone) ?? [];
            if (items.length === 0) return null;
            const offsite = zone === OFF_ZONE;
            const dueHere = items.filter((a) => pmStatus(a) === 'overdue' || pmStatus(a) === 'due-soon').length;
            return (
              <div className="bldg" key={zone}>
                <div className="bldg-h">
                  <i className={'ti ' + (offsite ? 'ti-map-pin' : buildingIcons[zone] || 'ti-building')} />
                  <span>{zone}</span>
                  <span className="bldg-cnt">{items.length}</span>
                  {dueHere > 0 && <span className="bldg-due">{dueHere} due</span>}
                </div>
                <div className="pin-list">
                  {items.map((a) => {
                    const st = pmStatus(a);
                    const meta = PM_META[st];
                    return (
                      <button key={a.id} className="pin" onClick={() => nav('/asset/' + a.id)}>
                        <span className="pin-dot" style={{ background: st === 'none' ? 'var(--text-3)' : meta.color }} />
                        <span className="pin-body">
                          <span className="pin-title">{a.name}</span>
                          <span className="pin-sub">
                            {a.code} · {a.category}
                            {a.location ? ' · ' + a.location : ''}
                          </span>
                        </span>
                        {(st === 'overdue' || st === 'due-soon') && <i className={'ti ' + meta.icon} style={{ color: meta.color }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {assetTotal === 0 && <div className="empty">No assets to map.</div>}
        </div>
      )}
    </div>
  );
}
