import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fmtTime, fmtDateShort, statusColor, DEMO_TODAY } from '../lib/data';

export default function RoomDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const room = db.rooms.find((r) => r.id === id);

  if (!room) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Room not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/spaces')}>
          Back to Spaces
        </button>
      </div>
    );
  }

  const now = DEMO_TODAY.getTime();
  const upcoming = db.events
    .filter((e) => e.rooms.includes(room.name) && e.starts_at && new Date(e.starts_at).getTime() >= now - 12 * 3600e3)
    .sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1))
    .slice(0, 25);

  return (
    <>
      <button className="back-link" onClick={() => nav('/spaces')}>
        <i className="ti ti-chevron-left" /> Spaces
      </button>

      <h1 className="page-h" style={{ marginTop: 6 }}>
        {room.name}
      </h1>
      <div className="page-sub">{room.folder}</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '14px 0' }}>
        <button className="fab" onClick={() => nav('/book')}>
          <i className="ti ti-plus" /> Book this room
        </button>
      </div>

      <div className="section-label">
        <span className="lbl">Upcoming bookings</span>
        <span className="act">{upcoming.length}</span>
      </div>

      <div className="list">
        {upcoming.length === 0 && <div className="empty">No upcoming bookings.</div>}
        {upcoming.map((e, i) => (
          <div key={e.id}>
            {i > 0 && <div className="divider" />}
            <button className="row" onClick={() => nav('/event/' + e.id)}>
              <span className="time tnum" style={{ width: 64 }}>
                {fmtDateShort(new Date(e.starts_at!)).replace(/^[A-Za-z]+, /, '')}
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.all_day ? 'All day' : fmtTime(e.starts_at)}</div>
              </span>
              <span className="dot" style={{ background: statusColor(e.status) }} />
              <span className="body">
                <span className="title">{e.name}</span>
                <span className="sub">{e.owner || 'No owner'}</span>
              </span>
              <i className="ti ti-chevron-right chev" />
            </button>
          </div>
        ))}
      </div>
      <div style={{ height: 16 }} />
    </>
  );
}
