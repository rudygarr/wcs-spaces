import { useState } from 'react';
import Modal, { field, primaryBtn } from './Modal';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { DEMO_TODAY, dayKey } from '../lib/data';
import { expectedOnCampus } from '../lib/security';
import { logVisitor } from '../lib/visitorLog';

const CAMPUSES = ['PS/ES Campus', 'MS Campus', 'HS Campus', 'CCC (College & Career Counseling)', 'Office', 'Other'];

// Replicates the "Daily Visitors to Campus" MS Form, plus the improvements the
// scope asked for (check-out, badge, link to person & event). The signed-in
// guard is captured automatically. Nothing here is persisted — logVisitor
// writes to session memory only (see lib/visitorLog).
export default function LogVisitorModal({ onClose }: { onClose: () => void }) {
  const { db } = useStore();
  const { user } = useSession();
  const today = dayKey(DEMO_TODAY);
  const nowHHMM = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(DEMO_TODAY);

  const [names, setNames] = useState('');
  const [time, setTime] = useState(nowHHMM);
  const [campus, setCampus] = useState(CAMPUSES[1]);
  const [reason, setReason] = useState('');
  const [overseer, setOverseer] = useState('');
  const [badge, setBadge] = useState('');
  const [eventId, setEventId] = useState('');

  const expected = expectedOnCampus(db, today);
  const staffNames = db.people.filter((p) => p.active !== false).map((p) => p.name).sort();

  function submit() {
    if (!names.trim()) return;
    logVisitor({
      names: names.trim(), date: today, time, campus, reason: reason.trim(),
      overseerName: overseer.trim() || undefined, badge: badge.trim() || undefined,
      eventId: eventId || undefined, loggedBy: user.name,
    });
    onClose();
  }

  return (
    <Modal title="Log a visitor" onClose={onClose}>
      <div className="vis-privacy">
        <i className="ti ti-lock" />
        Not saved to disk. Visitor names stay in this session only and clear on reload — never written to the database.
      </div>

      <label className="vis-label">Visitor name(s)
        <input style={field} value={names} onChange={(e) => setNames(e.target.value)} placeholder="e.g. Maria Morales, Luis Morales" autoFocus />
      </label>

      <div className="vis-row">
        <label className="vis-label" style={{ flex: 1 }}>Date
          <input style={{ ...field, color: 'var(--text-3)' }} value={today} readOnly />
        </label>
        <label className="vis-label" style={{ flex: 1 }}>Time in
          <input type="time" style={{ ...field, appearance: 'auto' }} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>

      <label className="vis-label">Meeting with
        <select style={{ ...field, appearance: 'auto' }} value={campus} onChange={(e) => setCampus(e.target.value)}>
          {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="vis-label">Reason for visit
        <input style={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Campus tour, delivery, meeting" />
      </label>

      <div className="vis-row">
        <label className="vis-label" style={{ flex: 1 }}>Personnel overseeing
          <input style={field} list="staff-list" value={overseer} onChange={(e) => setOverseer(e.target.value)} placeholder="Staff member" />
          <datalist id="staff-list">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <label className="vis-label" style={{ flex: 1 }}>Badge #
          <input style={field} value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="optional" />
        </label>
      </div>

      {expected.length > 0 && (
        <label className="vis-label">Link to a booking (optional)
          <select style={{ ...field, appearance: 'auto' }} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— none —</option>
            {expected.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.expectedVisitors?.time})</option>)}
          </select>
        </label>
      )}

      <button style={{ ...primaryBtn, marginTop: 16, opacity: names.trim() ? 1 : 0.5 }} disabled={!names.trim()} onClick={submit}>
        Sign in visitor
      </button>
    </Modal>
  );
}
