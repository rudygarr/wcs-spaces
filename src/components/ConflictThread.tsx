import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtTime, fmtDateLong } from '../lib/data';
import type { EventRec } from '../lib/types';

// The differentiator made concrete: a double-booking opens a conversation
// between the two owners instead of blocking either one. They can shift, share,
// or accept the overlap — accepting clears the warning everywhere.
const QUICK = [
  'Could you shift your time a bit?',
  'We can share the space — go ahead.',
  'I only need the front half of the room.',
];

export function ConflictThread({
  conflictKey,
  other,
  room,
  resolved,
}: {
  conflictKey: string;
  other: EventRec;
  room: string;
  resolved: boolean;
}) {
  const { db, addConflictNote } = useStore();
  const { user } = useSession();
  const [draft, setDraft] = useState('');

  const notes = (db.conflictNotes ?? [])
    .filter((n) => n.conflictKey === conflictKey)
    .sort((a, b) => a.at.localeCompare(b.at));

  function post(body: string, kind: 'note' | 'accept' = 'note') {
    const text = body.trim();
    if (!text) return;
    addConflictNote({ conflictKey, author: user.name, body: text, kind });
    setDraft('');
  }

  return (
    <div className="cthread">
      <div className="ct-head">
        <span className="ct-room">{room}</span>
        <span className="ct-other">
          overlaps <b>{other.name}</b>
          {other.owner ? ` · ${other.owner}` : ''}
          {other.starts_at ? ` · ${fmtTime(other.starts_at)}` : ''}
        </span>
      </div>

      {resolved ? (
        <div className="ct-resolved">
          <i className="ti ti-circle-check" /> Worked out — both bookings stand.
        </div>
      ) : (
        <div className="ct-status">
          <i className="ti ti-messages" /> Talk it through, then accept the overlap or change a time.
        </div>
      )}

      {notes.length > 0 && (
        <div className="ct-msgs">
          {notes.map((n) => (
            <div key={n.id} className={'ct-msg' + (n.author === user.name ? ' mine' : '')}>
              <div className="ct-meta">
                {n.author}
                {n.kind === 'accept' && <span className="ct-accept-tag"> accepted the overlap</span>} · {fmtDateLong(new Date(n.at))}
              </div>
              <div className="ct-bubble">{n.body}</div>
            </div>
          ))}
        </div>
      )}

      {!resolved && (
        <>
          <div className="ct-quick">
            {QUICK.map((q) => (
              <button key={q} className="chip" onClick={() => post(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="ct-compose">
            <input
              className="ct-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') post(draft);
              }}
              placeholder={`Message ${other.owner || 'the other owner'}…`}
            />
            <button className="ct-send" onClick={() => post(draft)} disabled={!draft.trim()}>
              <i className="ti ti-send" />
            </button>
          </div>
          <button className="ct-accept" onClick={() => post('Accepted the overlap — both can use the space.', 'accept')}>
            <i className="ti ti-circle-check" /> Accept overlap &amp; clear warning
          </button>
        </>
      )}
    </div>
  );
}
