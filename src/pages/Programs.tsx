import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { fmtDateLong } from '../lib/data';
import { sessionsOf, programApproval } from '../lib/programs';

export default function Programs() {
  const nav = useNavigate();
  const { db } = useStore();
  const programs = (db.programs ?? []).slice().sort((a, b) => a.startsDate.localeCompare(b.startsDate));

  return (
    <>
      <h1 className="page-h">Programs</h1>
      <div className="page-sub">
        Multi-session events — a festival, a conference, a Sunday rental — wrapped under one umbrella.
        Each session is a real booking that holds its room and routes approval; the program just lets you
        build, submit, and cancel them as a set.
      </div>

      {programs.length === 0 && <div className="empty" style={{ marginTop: 20 }}>No programs yet.</div>}
      <div className="list" style={{ marginTop: 16 }}>
        {programs.map((p, i) => {
          const n = sessionsOf(db, p.id).length;
          const appr = programApproval(db, p.id);
          const tone = p.status === 'Approved' ? 'ok' : p.status === 'Cancelled' ? 'bad' : p.status === 'Submitted' ? 'info' : 'muted';
          return (
            <div key={p.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <button className="row" onClick={() => nav('/program/' + p.id)}>
                <span className="body">
                  <span className="title" style={{ textDecoration: p.status === 'Cancelled' ? 'line-through' : undefined }}>{p.name}</span>
                  <span className="sub">
                    {p.startsDate === p.endsDate
                      ? fmtDateLong(new Date(p.startsDate + 'T12:00:00'))
                      : `${fmtDateLong(new Date(p.startsDate + 'T12:00:00'))} → ${fmtDateLong(new Date(p.endsDate + 'T12:00:00'))}`}
                    {' · '}{n} session{n === 1 ? '' : 's'}
                    {p.status === 'Submitted' && ` · ${appr.percent}% approved`}
                  </span>
                </span>
                <span className={'pill ' + tone} style={{ marginRight: 6 }}>{p.status}</span>
                <i className="ti chev ti-chevron-right" />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}
