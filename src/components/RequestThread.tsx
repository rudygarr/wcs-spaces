import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession, initials } from '../lib/session';
import { auditTime } from '../lib/audit';

// The conversation on a request. Anyone can read it; posting a comment pings the
// other participants (requester + whoever's handling it) so nobody has to keep
// re-opening the ticket to see if there's a reply — the Incident IQ gripe.
export default function RequestThread({
  entityId,
  link,
  title,
  participants,
}: {
  entityId: string;
  link: string; // hash route to this request, for the notification
  title: string;
  participants: string[]; // who to notify on a new comment
}) {
  const { db, addComment, notify } = useStore();
  const { user } = useSession();
  const [draft, setDraft] = useState('');

  const thread = (db.comments ?? [])
    .filter((c) => c.entityId === entityId)
    .sort((a, b) => a.at.localeCompare(b.at));

  function post() {
    const body = draft.trim();
    if (!body) return;
    addComment(entityId, user.name, body);
    // Notify everyone involved except whoever just spoke.
    const seen = new Set<string>();
    for (const p of participants) {
      if (!p || p === user.name || seen.has(p)) continue;
      seen.add(p);
      notify({ to: p, kind: 'comment', title: `${user.name.split(' ')[0]} commented on ${title}`, body, link });
    }
    setDraft('');
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-label">
        <span className="lbl">Discussion{thread.length ? ` · ${thread.length}` : ''}</span>
      </div>

      {thread.length === 0 && (
        <div className="page-sub" style={{ fontSize: 12.5, marginBottom: 10 }}>
          No comments yet. Ask a question or add context — the requester and the team both get notified.
        </div>
      )}

      <div className="cmt-list">
        {thread.map((c) => {
          const mine = c.author === user.name;
          return (
            <div key={c.id} className={'cmt' + (mine ? ' mine' : '')}>
              <span className="audit-avatar cmt-av">{initials(c.author)}</span>
              <div className="cmt-bubble">
                <div className="cmt-meta">
                  <span className="cmt-author">{mine ? 'You' : c.author}</span>
                  <span className="cmt-time">{auditTime(c.at)}</span>
                </div>
                <div className="cmt-body">{c.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cmt-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <button className="fab" style={{ justifyContent: 'center', opacity: draft.trim() ? 1 : 0.5 }} disabled={!draft.trim()} onClick={post}>
          <i className="ti ti-send" /> Post
        </button>
      </div>
    </div>
  );
}
