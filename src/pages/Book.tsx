import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { dayKey, DEMO_TODAY } from '../lib/data';
import { field, primaryBtn } from '../components/Modal';

export default function Book() {
  const nav = useNavigate();
  const { db, addEvent } = useStore();
  const { user } = useSession();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [date, setDate] = useState(params.get('date') || dayKey(DEMO_TODAY));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [rooms, setRooms] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const isAdmin = user.site_admin;

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  function submit() {
    if (!name.trim() || rooms.length === 0) return;
    const starts = new Date(`${date}T${start}`).toISOString();
    const ends = new Date(`${date}T${end}`).toISOString();
    const ev = addEvent({
      name: name.trim(),
      starts_at: starts,
      ends_at: ends,
      all_day: false,
      setup_starts: null,
      teardown_ends: null,
      recurrence: null,
      location: rooms[0] ?? null,
      owner: user.name,
      // Admins' own bookings auto-approve; everyone else lands in the queue.
      status: isAdmin ? 'Approved' : 'Pending',
      percent_approved: isAdmin ? 100 : 0,
      details: details.trim() || null,
      rooms,
      resources,
    });
    setDone(ev.id);
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 50 }}>
        <i
          className={'ti ' + (isAdmin ? 'ti-circle-check' : 'ti-clock-hour-4')}
          style={{ fontSize: 56, color: isAdmin ? 'var(--ok)' : 'var(--warn)' }}
        />
        <h1 className="page-h" style={{ marginTop: 14 }}>
          {isAdmin ? 'Booked' : 'Request sent'}
        </h1>
        <div className="page-sub" style={{ maxWidth: 320, margin: '0 auto 26px' }}>
          {isAdmin
            ? `${name} is confirmed and on the calendar.`
            : `${name} is pending approval. You'll be notified once a space admin signs off.`}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-soft" onClick={() => nav('/event/' + done)}>
            View booking
          </button>
          <button className="fab" onClick={() => nav('/calendar?date=' + date)}>
            Open calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-h">Book a space</h1>
      <div className="page-sub">
        Booking as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> ·{' '}
        {isAdmin ? 'auto-approved' : 'needs approval'}
      </div>

      <label className="flabel">Event name</label>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Booster Club meeting" autoFocus />

      <label className="flabel">Date</label>
      <input style={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="flabel">Start</label>
          <input style={field} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="flabel">End</label>
          <input style={field} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <label className="flabel">Room{rooms.length > 0 ? ` · ${rooms.length} selected` : ''}</label>
      <div className="chips">
        {db.rooms.map((r) => (
          <button key={r.id} className={'chip' + (rooms.includes(r.name) ? ' on' : '')} onClick={() => toggle(rooms, setRooms, r.name)}>
            {r.name}
          </button>
        ))}
      </div>

      <label className="flabel">Resources{resources.length > 0 ? ` · ${resources.length} selected` : ''}</label>
      <div className="chips">
        {db.resources.map((r) => (
          <button
            key={r.id}
            className={'chip' + (resources.includes(r.name) ? ' on' : '')}
            onClick={() => toggle(resources, setResources, r.name)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <label className="flabel">Notes</label>
      <textarea
        style={{ ...field, height: 76, padding: '10px 12px', resize: 'vertical' }}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Setup needs, headcount, anything the approver should know"
      />

      <button
        style={{ ...primaryBtn, marginTop: 22, opacity: !name.trim() || rooms.length === 0 ? 0.5 : 1 }}
        onClick={submit}
        disabled={!name.trim() || rooms.length === 0}
      >
        {isAdmin ? 'Book it' : 'Send request'}
      </button>
      <div style={{ height: 20 }} />
    </>
  );
}
