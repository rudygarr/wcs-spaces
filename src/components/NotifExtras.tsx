import { useState } from 'react';
import Modal, { primaryBtn } from './Modal';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { prefsFor, demoEmail, CHANNEL_META } from '../lib/notify';
import type { Notif } from '../lib/types';

// Shows exactly what lands in the recipient's inbox / Teams — the stand-in for
// real M365 delivery. Visual only; nothing is actually sent.
export function DeliveryPreview({ notif, onClose }: { notif: Notif; onClose: () => void }) {
  const channels = notif.channels ?? ['in-app'];
  const to = demoEmail(notif.to);
  return (
    <Modal title="Delivery preview" onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 0 }}>
        In production this message reaches {notif.to.split(' ')[0]} on every channel below. This is a stand-in — no mail
        is sent from the demo.
      </p>

      {channels.includes('email') && (
        <div className="dp-card">
          <div className="dp-card-h">
            <i className="ti ti-mail" /> Email
          </div>
          <div className="dp-email">
            <div className="dp-email-row"><span>From</span> Steward &lt;no-reply@demo.wcsmiami.org&gt;</div>
            <div className="dp-email-row"><span>To</span> {to}</div>
            <div className="dp-email-row"><span>Subject</span> {notif.title}</div>
            <div className="dp-email-body">
              {notif.body && <p>{notif.body}</p>}
              <p>You can review and act on this in Steward.</p>
              <span className="dp-btn">Open in Steward →</span>
            </div>
          </div>
        </div>
      )}

      {channels.includes('teams') && (
        <div className="dp-card">
          <div className="dp-card-h">
            <i className="ti ti-brand-teams" /> Microsoft Teams
          </div>
          <div className="dp-teams">
            <div className="dp-teams-bot">
              <span className="dp-teams-ic"><i className="ti ti-shield-chevron" /></span>
              <div>
                <div className="dp-teams-name">Steward <span>· bot</span></div>
                <div className="dp-teams-title">{notif.title}</div>
              </div>
            </div>
            {notif.body && <div className="dp-teams-body">{notif.body}</div>}
            <span className="dp-btn">Open in Steward</span>
          </div>
        </div>
      )}

      <div className="dp-chips" style={{ marginTop: 14 }}>
        {channels.map((c) => (
          <span key={c} className="dp-chip">
            <i className={'ti ' + CHANNEL_META[c].icon} /> {CHANNEL_META[c].label}
          </span>
        ))}
      </div>
    </Modal>
  );
}

// Lets the current user choose how they get pinged. Saved to their person
// record so notify() routes future messages accordingly.
export function NotifSettings({ onClose }: { onClose: () => void }) {
  const { db, updatePerson } = useStore();
  const { user } = useSession();
  const me = db.people.find((p) => p.id === user.id) ?? user;
  const prefs = prefsFor(me);
  const [email, setEmail] = useState(prefs.email);
  const [teams, setTeams] = useState(prefs.teams);
  const [digest, setDigest] = useState(prefs.digest);

  function save() {
    updatePerson(me.id, { notifyPrefs: { email, teams, digest } });
    onClose();
  }

  return (
    <Modal title="Notification settings" onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 0 }}>
        The in-app bell is always on. Choose where else Steward reaches you.
      </p>

      <Toggle label="Email" sub="To your school address" icon="ti-mail" on={email} onChange={setEmail} />
      <Toggle label="Microsoft Teams" sub="Chat from the Steward bot" icon="ti-brand-teams" on={teams} onChange={setTeams} />

      <div className="flabel" style={{ marginTop: 16, marginBottom: 8 }}>Frequency</div>
      <div className="seg seg-sm">
        <button className={digest === 'instant' ? 'active' : ''} onClick={() => setDigest('instant')}>
          Right away
        </button>
        <button className={digest === 'daily' ? 'active' : ''} onClick={() => setDigest('daily')}>
          Daily summary
        </button>
      </div>

      <button style={{ ...primaryBtn, marginTop: 20 }} onClick={save}>
        Save preferences
      </button>
    </Modal>
  );
}

function Toggle({
  label,
  sub,
  icon,
  on,
  onChange,
}: {
  label: string;
  sub: string;
  icon: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className="pref-row" onClick={() => onChange(!on)}>
      <span className="pref-ic"><i className={'ti ' + icon} /></span>
      <span className="pref-text">
        <span className="pref-label">{label}</span>
        <span className="pref-sub">{sub}</span>
      </span>
      <span className={'switch' + (on ? ' on' : '')}>
        <span className="switch-knob" />
      </span>
    </button>
  );
}
