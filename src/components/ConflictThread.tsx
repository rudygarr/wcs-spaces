import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtTime, fmtDateLong } from '../lib/data';
import { roomsFreeFor } from '../lib/conflicts';
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
  self,
  other,
  room,
  resolved,
  buffer,
}: {
  conflictKey: string;
  self: EventRec;
  other: EventRec;
  room: string;
  resolved: boolean;
  buffer?: boolean;
}) {
  const { db, addConflictNote, moveEventRoom } = useStore();
  const { user } = useSession();
  const [draft, setDraft] = useState('');
  const [moveTo, setMoveTo] = useState('');

  // Free rooms this booking could slide into, grouped by area for the picker.
  const freeRooms = roomsFreeFor(db, self);
  const freeByFolder = [...new Set(db.rooms.filter((r) => freeRooms.includes(r.name)).map((r) => r.folder))].sort();

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
          {buffer ? 'setup/teardown overlaps' : 'overlaps'} <b>{other.name}</b>
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
          <i className="ti ti-messages" /> Talk it through, then accept the overlap, move to a free room, or change a time.
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

          {freeRooms.length > 0 && (
            <div className="ct-move">
              <span className="ct-move-label">…or move “{self.name}” out of the clash:</span>
              <div className="ct-move-row">
                <select className="ct-move-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Move to a free room…</option>
                  {freeByFolder.map((folder) => (
                    <optgroup key={folder} label={folder}>
                      {db.rooms
                        .filter((r) => r.folder === folder && freeRooms.includes(r.name))
                        .map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  className="ct-move-btn"
                  disabled={!moveTo}
                  onClick={() => {
                    moveEventRoom(self.id, room, moveTo);
                    setMoveTo('');
                  }}
                >
                  <i className="ti ti-arrows-exchange" /> Move
                </button>
              </div>
              <span className="ct-move-hint">Frees {room} for {other.owner || 'the other booking'} — no overlap left to work out.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
