import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtDateLong, fmtTime } from '../lib/data';
import { sessionsOf, programDays, programApproval, agendaForDay } from '../lib/programs';
import { derivedStatus, approvalSteps } from '../lib/approvals';

// One pixel-per-minute scale would be too wide; 1.1px/min keeps a full festival
// day legible while still showing relative length and overlap at a glance.
const PXMIN = 1.1;

function fmtHour(min: number): string {
  const h = Math.floor(min / 60);
  const ap = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ap}`;
}

export default function ProgramDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, submitProgram, cancelProgram, detachSession } = useStore();
  const { user } = useSession();
  const prog = (db.programs ?? []).find((p) => p.id === id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!prog) return <div className="empty" style={{ marginTop: 40 }}>Program not found.</div>;

  const sessions = sessionsOf(db, prog.id);
  const days = programDays(db, prog.id);
  const appr = programApproval(db, prog.id);
  const canManage = user.site_admin || user.resolves_conflicts || prog.owner === user.name;
  const isCancelled = prog.status === 'Cancelled';

  const statusTone =
    prog.status === 'Approved' ? 'ok' : prog.status === 'Cancelled' ? 'bad' : prog.status === 'Submitted' ? 'info' : 'muted';

  return (
    <>
      <button className="back-link" onClick={() => nav('/programs')}><i className="ti ti-chevron-left" /> Programs</button>
      <div className="prog-head">
        <span className={'pill ' + statusTone}>{prog.status}</span>
        <h1 className="page-h" style={{ marginTop: 8, textDecoration: isCancelled ? 'line-through' : undefined }}>{prog.name}</h1>
        <div className="page-sub">
          {days.length > 0
            ? days.length === 1
              ? fmtDateLong(new Date(days[0] + 'T12:00:00'))
              : `${fmtDateLong(new Date(days[0] + 'T12:00:00'))} → ${fmtDateLong(new Date(days[days.length - 1] + 'T12:00:00'))}`
            : `${prog.startsDate} → ${prog.endsDate}`}
          {'  ·  '}{sessions.length} session{sessions.length === 1 ? '' : 's'} · owner {prog.owner}
        </div>
        {prog.notes && <div className="page-sub" style={{ fontSize: 13 }}>{prog.notes}</div>}
      </div>

      {/* Approval rollup — one number across every session's room sign-offs (§13.6). */}
      <div className="prog-roll">
        <div className="prog-roll-bar"><span style={{ width: `${appr.percent}%` }} /></div>
        <div className="prog-roll-meta">
          <strong>{appr.percent}%</strong> approved
          <span className="dot">·</span>{appr.approved}/{appr.total} room sign-offs
          {appr.declined > 0 && <><span className="dot">·</span><span className="bad-txt">{appr.declined} declined</span></>}
        </div>
      </div>

      {canManage && !isCancelled && (
        <div className="prog-actions">
          {prog.status === 'Draft' && (
            <button className="btn-primary" onClick={() => submitProgram(prog.id)}>
              <i className="ti ti-send" /> Submit all {sessions.length} for approval
            </button>
          )}
          {!confirmCancel ? (
            <button className="btn-soft" onClick={() => setConfirmCancel(true)}><i className="ti ti-ban" /> Cancel program</button>
          ) : (
            <span className="prog-confirm">
              Cancel all {sessions.length} sessions?
              <button className="cb-yes" onClick={() => { cancelProgram(prog.id, true); setConfirmCancel(false); }}>Yes, cancel</button>
              <button className="cb-no" onClick={() => setConfirmCancel(false)}>Keep</button>
            </span>
          )}
        </div>
      )}
      {canManage && isCancelled && (
        <div className="prog-actions">
          <button className="btn-soft" onClick={() => cancelProgram(prog.id, false)}><i className="ti ti-rotate" /> Reinstate program</button>
        </div>
      )}

      {/* Agenda grid: one row per room, blocks placed on a shared time axis. */}
      {days.map((key) => {
        const rows = agendaForDay(db, prog.id, key);
        const allBlocks = rows.flatMap((r) => r.blocks);
        if (allBlocks.length === 0) return null;
        const minStart = Math.floor(Math.min(...allBlocks.map((b) => b.startMin)) / 60) * 60;
        const maxEnd = Math.ceil(Math.max(...allBlocks.map((b) => b.endMin)) / 60) * 60;
        const width = (maxEnd - minStart) * PXMIN;
        const ticks: number[] = [];
        for (let m = minStart; m <= maxEnd; m += 60) ticks.push(m);
        return (
          <div key={key} className="agenda">
            <div className="agenda-day">{fmtDateLong(new Date(key + 'T12:00:00'))}</div>
            <div className="agenda-scroll">
              <div className="agenda-grid" style={{ width: width + 130 }}>
                <div className="agenda-axis" style={{ marginLeft: 130 }}>
                  {ticks.map((m) => (
                    <span key={m} className="agenda-tick" style={{ left: (m - minStart) * PXMIN }}>{fmtHour(m)}</span>
                  ))}
                </div>
                {rows.map((row) => (
                  <div key={row.room} className="agenda-row">
                    <span className="agenda-room">{row.room}</span>
                    <div className="agenda-lane" style={{ width }}>
                      {ticks.map((m) => (
                        <span key={m} className="agenda-gl" style={{ left: (m - minStart) * PXMIN }} />
                      ))}
                      {row.blocks.map((b) => {
                        const st = derivedStatus(approvalSteps(db, b.session), b.session.status);
                        const tone = st === 'Approved' ? 'ok' : st === 'Declined' ? 'bad' : 'pending';
                        return (
                          <button
                            key={b.session.id}
                            className={'agenda-block ' + tone}
                            style={{ left: (b.startMin - minStart) * PXMIN, width: Math.max((b.endMin - b.startMin) * PXMIN - 3, 40) }}
                            onClick={() => nav('/event/' + b.session.id)}
                            title={`${b.session.name} · ${fmtTime(b.session.starts_at)}–${fmtTime(b.session.ends_at)}`}
                          >
                            <span className="agenda-block-t">{b.session.name}</span>
                            <span className="agenda-block-time">{fmtTime(b.session.starts_at)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Plain session list — the agenda's accessible twin, with per-session status. */}
      <div className="section-label" style={{ marginTop: 24 }}>
        <span className="lbl">All sessions</span>
        <span className="act">{sessions.length}</span>
      </div>
      {sessions.length === 0 && <div className="empty">No sessions yet.</div>}
      <div className="list">
        {sessions.map((e, i) => {
          const st = derivedStatus(approvalSteps(db, e), e.status);
          const tone = st === 'Approved' ? 'ok' : st === 'Declined' ? 'bad' : st === 'Pending' ? 'info' : 'muted';
          return (
            <div key={e.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <button className="row" onClick={() => nav('/event/' + e.id)}>
                <span className="body">
                  <span className="title" style={{ textDecoration: e.cancelled ? 'line-through' : undefined }}>{e.name}</span>
                  <span className="sub">{e.starts_at ? `${fmtDateLong(new Date(e.starts_at))} · ${fmtTime(e.starts_at)}–${fmtTime(e.ends_at)}` : ''} · {e.rooms.join(', ')}</span>
                </span>
                <span className={'pill ' + tone} style={{ marginRight: 6 }}>{e.cancelled ? 'Cancelled' : st}</span>
                {canManage && !isCancelled && (
                  <button className="cb-x" title="Remove from program" onClick={(ev) => { ev.stopPropagation(); detachSession(e.id); }}><i className="ti ti-unlink" /></button>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}
