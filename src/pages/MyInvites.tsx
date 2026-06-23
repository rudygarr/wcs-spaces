import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtDateLong, fmtTime } from '../lib/data';
import { myInvites } from '../lib/invites';
import { busOfInvite, busLabel, cabinOfInvite, roomOfInvite, dutiesForPerson, shiftWindow } from '../lib/camps';
import type { InviteStatus } from '../lib/types';

const STATUS: Record<InviteStatus, { label: string; cls: string }> = {
  accepted: { label: 'Going', cls: 'inv-ok' },
  declined: { label: 'Not going', cls: 'inv-no' },
  tentative: { label: 'Maybe', cls: 'inv-maybe' },
  invited: { label: 'No reply', cls: 'inv-pending' },
};

export default function MyInvites() {
  const nav = useNavigate();
  const { db, respondInvite } = useStore();
  const { user } = useSession();
  const mine = myInvites(db, user.id);
  const pending = mine.filter((i) => i.status === 'invited');
  const replied = mine.filter((i) => i.status !== 'invited');
  const duties = dutiesForPerson(db, user.id);
  const roleName = (id: string) => db.campRoles?.find((r) => r.id === id)?.name ?? 'Role';
  const shiftOf = (id?: string) => (id ? db.campShifts?.find((s) => s.id === id) : undefined);

  function row(invId: string, eventId: string) {
    const ev = db.events.find((e) => e.id === eventId);
    const i = mine.find((x) => x.id === invId)!;
    const bus = busOfInvite(db, i);
    const cabin = cabinOfInvite(db, i);
    const room = roomOfInvite(db, i);
    return (
      <div key={invId} className="inv-card">
        <button className="inv-card-main" onClick={() => ev && nav('/event/' + ev.id)}>
          <span className="inv-card-title">{ev?.name ?? 'Event'}{i.role && <span className="inv-role">{i.role}</span>}</span>
          <span className="inv-card-sub">
            {ev?.starts_at ? `${fmtDateLong(new Date(ev.starts_at))} · ${fmtTime(ev.starts_at)}` : ''}
            {ev?.location ? ` · ${ev.location}` : ''}
          </span>
          {bus && <span className="inv-card-bus"><i className="ti ti-bus" /> Your bus: <strong>{busLabel(bus)}</strong>{bus.departInfo ? ` · ${bus.departInfo}` : ''}</span>}
          {cabin && <span className="inv-card-bus"><i className="ti ti-home" /> Your cabin: <strong>{cabin.name}{room ? ` · ${room.name}` : ''}</strong>{i.cabinLeader ? ' · leader' : ''}</span>}
          {i.note && <span className="inv-card-note">“{i.note}”</span>}
        </button>
        <div className="inv-rsvp">
          <button className={'inv-rsvp-btn yes' + (i.status === 'accepted' ? ' on' : '')} onClick={() => respondInvite(invId, 'accepted')}>Accept</button>
          <button className={'inv-rsvp-btn maybe' + (i.status === 'tentative' ? ' on' : '')} onClick={() => respondInvite(invId, 'tentative')}>Maybe</button>
          <button className={'inv-rsvp-btn no' + (i.status === 'declined' ? ' on' : '')} onClick={() => respondInvite(invId, 'declined')}>Decline</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-h">My invitations</h1>
      <div className="page-sub">Events you’ve been invited to — accept, decline, or mark maybe.</div>

      <div className="section-label" style={{ marginTop: 20 }}>
        <span className="lbl">Needs a reply</span>
        {pending.length > 0 && <span className="act">{pending.length}</span>}
      </div>
      {pending.length === 0 && <div className="empty">You’re all caught up.</div>}
      {pending.map((i) => row(i.id, i.eventId))}

      {replied.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Replied</span>
            <span className="act">{replied.length}</span>
          </div>
          {replied.map((i) => {
            const ev = db.events.find((e) => e.id === i.eventId);
            const bus = busOfInvite(db, i);
            const cabin = cabinOfInvite(db, i);
            const room = roomOfInvite(db, i);
            return (
              <div key={i.id} className="inv-card replied">
                <button className="inv-card-main" onClick={() => nav('/event/' + i.eventId)}>
                  <span className="inv-card-title">{ev?.name ?? 'Event'}</span>
                  <span className="inv-card-sub">{ev?.starts_at ? `${fmtDateLong(new Date(ev.starts_at))} · ${fmtTime(ev.starts_at)}` : ''}</span>
                  {bus && <span className="inv-card-bus"><i className="ti ti-bus" /> Your bus: <strong>{busLabel(bus)}</strong>{bus.departInfo ? ` · ${bus.departInfo}` : ''}</span>}
                  {cabin && <span className="inv-card-bus"><i className="ti ti-home" /> Your cabin: <strong>{cabin.name}{room ? ` · ${room.name}` : ''}</strong>{i.cabinLeader ? ' · leader' : ''}</span>}
                </button>
                <span className={'inv-chip ' + STATUS[i.status].cls}>{STATUS[i.status].label}</span>
              </div>
            );
          })}
        </>
      )}

      {duties.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Your camp jobs</span>
            <span className="act">{duties.length}</span>
          </div>
          {duties.map((d) => {
            const ev = db.events.find((e) => e.id === d.eventId);
            const s = shiftOf(d.shiftId);
            return (
              <div key={d.id} className="inv-card replied">
                <button className="inv-card-main" onClick={() => nav('/event/' + d.eventId)}>
                  <span className="inv-card-title">{roleName(d.roleId)}{s && <span className="inv-role">{s.name}</span>}</span>
                  <span className="inv-card-sub">{ev?.name ?? 'Camp'}{s && shiftWindow(s) ? ` · ${shiftWindow(s)}` : ''}</span>
                </button>
              </div>
            );
          })}
        </>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
