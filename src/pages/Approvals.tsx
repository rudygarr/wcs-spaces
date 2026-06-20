import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { approvalSteps, pendingForApprover, isApprovable } from '../lib/approvals';
import { fmtDateLong, fmtTime } from '../lib/data';

export default function Approvals() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();

  const isOverride = user.site_admin || user.resolves_conflicts;
  // Mine = booking requests waiting on my sign-off. Admins/resolvers also get a
  // catch-all of everything still pending anywhere.
  const mineFull = pendingForApprover(db, user.name);
  const MINE_CAP = 40;
  const mine = mineFull.slice(0, MINE_CAP);
  const all = isOverride
    ? db.events.filter((e) => isApprovable(e) && approvalSteps(db, e).length > 0)
    : [];
  const others = all.filter((e) => !mineFull.some((m) => m.id === e.id));

  function Row({ id }: { id: string }) {
    const e = db.events.find((ev) => ev.id === id)!;
    const steps = approvalSteps(db, e);
    const waiting = steps.filter((s) => s.status === 'Pending').map((s) => s.approver);
    return (
      <button className="row" onClick={() => nav('/event/' + e.id)}>
        <span className="time tnum">{e.starts_at ? fmtTime(e.starts_at) : ''}</span>
        <span className="dot" style={{ background: 'var(--warn)' }} />
        <span className="body">
          <span className="title">{e.name}</span>
          <span className="sub">
            {(e.rooms[0] || 'No room')} · {e.starts_at ? fmtDateLong(new Date(e.starts_at)) : 'No date'}
            {waiting.length ? ` · waiting on ${waiting.join(', ')}` : ''}
          </span>
        </span>
        <i className="ti ti-chevron-right chev" />
      </button>
    );
  }

  return (
    <>
      <h1 className="page-h">Approvals</h1>
      <div className="page-sub">Booking requests routed to you as a space owner.</div>

      <div className="section-label">
        <span className="lbl">Awaiting your sign-off</span>
        <span className="act">{mineFull.length}</span>
      </div>
      <div className="list" style={{ marginBottom: mineFull.length > MINE_CAP ? 8 : 22 }}>
        {mine.length === 0 && <div className="empty">Nothing waiting on you — you're clear.</div>}
        {mine.map((e, i) => (
          <div key={e.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 91 }} />}
            <Row id={e.id} />
          </div>
        ))}
      </div>
      {mineFull.length > MINE_CAP && (
        <div className="page-sub" style={{ textAlign: 'center', marginBottom: 22 }}>
          Showing {MINE_CAP} of {mineFull.length}.
        </div>
      )}

      {isOverride && others.length > 0 && (
        <>
          <div className="section-label">
            <span className="lbl">Pending elsewhere</span>
            <span className="act">{others.length}</span>
          </div>
          <div className="list">
            {others.slice(0, 40).map((e, i) => (
              <div key={e.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 91 }} />}
                <Row id={e.id} />
              </div>
            ))}
          </div>
          {others.length > 40 && (
            <div className="page-sub" style={{ textAlign: 'center', marginTop: 8 }}>
              Showing 40 of {others.length}.
            </div>
          )}
        </>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
