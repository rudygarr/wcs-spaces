import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtDateLong } from '../lib/data';
import { myAssignments, pendingForPerson } from '../lib/crew';
import { field, primaryBtn } from '../components/Modal';

export default function MySchedule() {
  const nav = useNavigate();
  const { db, respondCrew, addBlockout, removeBlockout } = useStore();
  const { user } = useSession();

  const pending = pendingForPerson(db, user.id);
  const mine = myAssignments(db, user.id);
  const confirmed = mine
    .filter((a) => a.status === 'accepted' || a.status === 'self')
    .map((a) => ({ a, ev: db.events.find((e) => e.id === a.eventId) }))
    .filter((x) => x.ev)
    .sort((x, y) => new Date(x.ev!.starts_at ?? '').getTime() - new Date(y.ev!.starts_at ?? '').getTime());
  const myBlockouts = (db.blockouts ?? []).filter((b) => b.personId === user.id).sort((a, b) => a.start.localeCompare(b.start));

  const posName = (id: string) => db.crewPositions?.find((p) => p.id === id)?.name ?? 'Crew';
  const teamName = (id: string) => db.crewTeams?.find((t) => t.id === id)?.name ?? '';

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  function saveBlockout() {
    if (!start) return;
    addBlockout({ personId: user.id, start, end: end || start, allDay: true, reason: reason.trim() || undefined });
    setStart(''); setEnd(''); setReason('');
  }

  return (
    <>
      <h1 className="page-h">My schedule</h1>
      <div className="page-sub">Requests to serve, your confirmed dates, and the days you're unavailable.</div>

      <div className="section-label" style={{ marginTop: 20 }}>
        <span className="lbl">Requests</span>
        {pending.length > 0 && <span className="act">{pending.length}</span>}
      </div>
      {pending.length === 0 && <div className="empty">No pending requests.</div>}
      <div className="list">
        {pending.map((a) => {
          const ev = db.events.find((e) => e.id === a.eventId);
          return (
            <div key={a.id} className="ms-req">
              <button className="ms-req-main" onClick={() => ev && nav('/event/' + ev.id)}>
                <span className="ms-req-title">{posName(a.positionId)} · {teamName(a.teamId)}</span>
                <span className="ms-req-sub">{ev?.name}{ev?.starts_at ? ` — ${fmtDateLong(new Date(ev.starts_at))}` : ''}</span>
              </button>
              <span className="cb-actions">
                <button className="cb-yes" onClick={() => respondCrew(a.id, true)}>Accept</button>
                <button className="cb-no" onClick={() => respondCrew(a.id, false)}>Decline</button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Confirmed</span>
        {confirmed.length > 0 && <span className="act">{confirmed.length}</span>}
      </div>
      {confirmed.length === 0 && <div className="empty">Nothing confirmed yet.</div>}
      <div className="list">
        {confirmed.map(({ a, ev }, i) => (
          <div key={a.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <button className="row" onClick={() => nav('/event/' + ev!.id)}>
              <span className="body">
                <span className="title">{ev!.name}</span>
                <span className="sub">{posName(a.positionId)}{ev!.starts_at ? ` · ${fmtDateLong(new Date(ev!.starts_at))}` : ''}</span>
              </span>
              <i className="ti chev ti-chevron-right" />
            </button>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Unavailable (blockouts)</span>
      </div>
      <div className="page-sub" style={{ fontSize: 13, marginBottom: 10 }}>
        Coordinators still see a soft warning and can schedule you anyway — never a hard block.
      </div>
      <div className="list">
        {myBlockouts.map((b, i) => (
          <div key={b.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <div className="row" style={{ cursor: 'default' }}>
              <span className="body">
                <span className="title">{b.start === b.end ? b.start : `${b.start} → ${b.end}`}</span>
                {b.reason && <span className="sub">{b.reason}</span>}
              </span>
              <button className="cb-x" title="Remove" onClick={() => removeBlockout(b.id)}><i className="ti ti-x" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="ms-blk-add">
        <div className="ms-blk-row">
          <label className="flabel" style={{ flex: 1 }}>From
            <input type="date" style={{ ...field, appearance: 'auto' }} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="flabel" style={{ flex: 1 }}>To (optional)
            <input type="date" style={{ ...field, appearance: 'auto' }} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <input style={{ ...field, marginTop: 8 }} placeholder="Reason (optional) — e.g. Family travel" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button style={{ ...primaryBtn, marginTop: 12, opacity: start ? 1 : 0.5 }} disabled={!start} onClick={saveBlockout}>
          Add blockout
        </button>
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}
