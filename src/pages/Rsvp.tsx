import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fmtDateLong, fmtTime } from '../lib/data';
import { busOfInvite, busLabel, cabinOfInvite, roomOfInvite } from '../lib/camps';
import helmetMark from '../assets/brand/warrior-helmet.png';
import type { InviteStatus } from '../lib/types';

// The public RSVP page — what an external guest (no account) reaches from the
// emailed invite link. No login gate: they read the details and reply. This is
// rendered outside the auth Gate (see App.tsx).
export default function Rsvp() {
  const { id } = useParams();
  const { db, respondInvite } = useStore();
  const invite = (db.invites ?? []).find((i) => i.id === id);
  const [done, setDone] = useState<InviteStatus | null>(invite && invite.status !== 'invited' ? invite.status : null);

  const ev = invite ? db.events.find((e) => e.id === invite.eventId) : null;

  function reply(status: InviteStatus) {
    if (!invite) return;
    respondInvite(invite.id, status);
    setDone(status);
  }

  return (
    <div className="rsvp-page">
      <div className="rsvp-card">
        <div className="rsvp-brand"><img src={helmetMark} alt="" /> Steward</div>

        {!invite || !ev ? (
          <div className="rsvp-gone">This invitation link is no longer valid.</div>
        ) : (
          <>
            <div className="rsvp-kicker">You’re invited{invite.role ? ` · ${invite.role}` : ''}</div>
            <h1 className="rsvp-title">{ev.name}</h1>
            <div className="rsvp-meta">
              <div><i className="ti ti-calendar" /> {ev.starts_at ? fmtDateLong(new Date(ev.starts_at)) : 'TBD'}</div>
              <div><i className="ti ti-clock" /> {ev.all_day ? 'All day' : `${fmtTime(ev.starts_at)} – ${fmtTime(ev.ends_at)}`}</div>
              {ev.location && <div><i className="ti ti-map-pin" /> {ev.location}</div>}
            </div>
            {(() => { const bus = busOfInvite(db, invite); return bus ? (
              <div className="rsvp-bus"><i className="ti ti-bus" /> Your bus: <strong>{busLabel(bus)}</strong>{bus.departInfo ? <span> · {bus.departInfo}</span> : null}</div>
            ) : null; })()}
            {(() => { const cabin = cabinOfInvite(db, invite); const room = roomOfInvite(db, invite); return cabin ? (
              <div className="rsvp-bus"><i className="ti ti-home" /> Your cabin: <strong>{cabin.name}{room ? ` · ${room.name}` : ''}</strong>{invite.cabinLeader ? <span> · you're a leader</span> : null}</div>
            ) : null; })()}
            {ev.details && <div className="rsvp-details">{ev.details}</div>}

            {done ? (
              <div className={'rsvp-done ' + done}>
                <i className={'ti ' + (done === 'accepted' ? 'ti-circle-check' : done === 'declined' ? 'ti-circle-x' : 'ti-help-circle')} />
                {done === 'accepted' ? 'You’re in — see you there!' : done === 'declined' ? 'Thanks for letting us know.' : 'Marked as maybe.'}
                <button className="rsvp-change" onClick={() => setDone(null)}>Change response</button>
              </div>
            ) : (
              <div className="rsvp-actions">
                <button className="rsvp-btn yes" onClick={() => reply('accepted')}><i className="ti ti-check" /> Accept</button>
                <button className="rsvp-btn maybe" onClick={() => reply('tentative')}>Maybe</button>
                <button className="rsvp-btn no" onClick={() => reply('declined')}>Decline</button>
              </div>
            )}
            <div className="rsvp-foot">No account needed — your reply goes straight to the organizer.</div>
          </>
        )}
      </div>
    </div>
  );
}
