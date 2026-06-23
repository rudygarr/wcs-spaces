import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { initials } from '../lib/session';
import { dayKey, DEMO_TODAY } from '../lib/data';
import { invitesFor, rsvpLabel } from '../lib/invites';
import { busesFor } from '../lib/camps';
import type { EventRec, InviteStatus } from '../lib/types';
import Modal, { field, primaryBtn } from './Modal';

const STATUS: Record<InviteStatus, { label: string; cls: string }> = {
  accepted: { label: 'Accepted', cls: 'inv-ok' },
  declined: { label: 'Declined', cls: 'inv-no' },
  tentative: { label: 'Maybe', cls: 'inv-maybe' },
  invited: { label: 'No reply', cls: 'inv-pending' },
};

export default function InvitePanel({ ev }: { ev: EventRec }) {
  const { db, removeInvite, remindInvite, remindAllDue } = useStore();
  const { user } = useSession();
  const [showInvite, setShowInvite] = useState(false);

  // Camp roster invites (busId set) are managed in the bus panel — exclude them
  // here so we don't list every camper twice.
  const invites = invitesFor(db, ev.id).filter((i) => !i.busId);
  const summary = {
    total: invites.length,
    accepted: invites.filter((i) => i.status === 'accepted').length,
    declined: invites.filter((i) => i.status === 'declined').length,
    tentative: invites.filter((i) => i.status === 'tentative').length,
    noReply: invites.filter((i) => i.status === 'invited').length,
  };
  const canManage = user.site_admin || user.resolves_conflicts || ev.owner === user.name;
  const isToday = ev.starts_at ? dayKey(new Date(ev.starts_at)) === dayKey(DEMO_TODAY) : false;
  const dueNow = invites.filter((i) => i.status === 'invited' && !i.remindedAt).length;
  const isCampWithBuses = busesFor(db, ev.id).length > 0;

  // Zero-footprint: hide if there's nothing to show and either you can't manage
  // or this is a camp (where invites live in the bus panel instead).
  if (invites.length === 0 && (!canManage || isCampWithBuses)) return null;

  return (
    <div className="inv-panel">
      <div className="inv-head">
        <span className="inv-title"><i className="ti ti-mail" /> Invitations</span>
        {canManage && <button className="inv-add" onClick={() => setShowInvite(true)}><i className="ti ti-plus" /> Invite people</button>}
      </div>

      {invites.length === 0 ? (
        <div className="inv-empty">No one invited yet. Invite staff or students — they’ll RSVP, and people without an account get an email link.</div>
      ) : (
        <>
          <div className="inv-summary">{rsvpLabel(summary)}</div>

          {canManage && isToday && dueNow > 0 && (
            <button className="inv-remind-all" onClick={() => remindAllDue(ev.id)}>
              <i className="ti ti-bell-ringing" /> Send day-of reminder to {dueNow} who haven’t replied
            </button>
          )}

          <div className="inv-list">
            {invites.map((i) => {
              const st = STATUS[i.status];
              return (
                <div key={i.id} className="inv-row">
                  <span className="avatar sm">{initials(i.name)}</span>
                  <span className="inv-who">
                    <span className="inv-name">{i.name}{i.role && <span className="inv-role">{i.role}</span>}</span>
                    <span className="inv-sub">
                      {i.personId
                        ? <><i className="ti ti-user-check" /> Account · in-app + email</>
                        : <><i className="ti ti-mail-forward" /> {i.email} · emailed link (no account)</>}
                      {i.remindedAt && <span className="inv-reminded"> · reminded</span>}
                    </span>
                  </span>
                  <span className={'inv-chip ' + st.cls}>{st.label}</span>
                  {canManage && (
                    <span className="inv-actions">
                      {i.status === 'invited' && !i.remindedAt && (
                        <button className="inv-mini" title="Send reminder" onClick={() => remindInvite(i.id)}><i className="ti ti-bell" /></button>
                      )}
                      <button className="inv-mini" title="Remove" onClick={() => removeInvite(i.id)}><i className="ti ti-x" /></button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showInvite && <InviteModal ev={ev} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function InviteModal({ ev, onClose }: { ev: EventRec; onClose: () => void }) {
  const { db, inviteToEvent } = useStore();
  const [q, setQ] = useState('');
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [role, setRole] = useState('');

  const already = new Set(invitesFor(db, ev.id).map((i) => i.personId).filter(Boolean));
  const matches = db.people
    .filter((p) => p.active !== false && !already.has(p.id))
    .filter((p) => q.trim() === '' || p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

  function inviteInternal(personId: string, name: string) {
    inviteToEvent(ev.id, { personId, name, role: role.trim() || undefined });
    setQ('');
  }
  function inviteExternal() {
    if (!extName.trim() || !extEmail.trim()) return;
    inviteToEvent(ev.id, { name: extName.trim(), email: extEmail.trim(), role: role.trim() || undefined });
    setExtName(''); setExtEmail('');
  }

  return (
    <Modal title={`Invite to ${ev.name}`} onClose={onClose}>
      <label className="vis-label">Role / label (optional, applies to who you add next)
        <input style={field} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Proctor, Student, Chaperone" />
      </label>

      <label className="vis-label">Invite someone with an account
        <input style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff & students…" autoFocus />
      </label>
      <div className="inv-pick">
        {matches.map((p) => (
          <button key={p.id} className="inv-pick-row" onClick={() => inviteInternal(p.id, p.name)}>
            <span className="avatar sm">{initials(p.name)}</span>
            <span className="inv-pick-name">{p.name}</span>
            <i className="ti ti-plus" />
          </button>
        ))}
        {matches.length === 0 && <div className="inv-empty" style={{ margin: 0 }}>No matches.</div>}
      </div>

      <div className="inv-divider"><span>or invite by email — no account needed</span></div>
      <div className="inv-ext">
        <input style={field} value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Guest name" />
        <input style={field} type="email" value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="email@example.com" />
        <button style={{ ...primaryBtn, height: 42, opacity: extName.trim() && extEmail.trim() ? 1 : 0.5 }} disabled={!extName.trim() || !extEmail.trim()} onClick={inviteExternal}>
          Email an invite
        </button>
      </div>
      <div className="inv-note"><i className="ti ti-info-circle" /> They’ll get an RSVP link they can open without logging in.</div>
    </Modal>
  );
}
