import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { initials } from '../lib/session';
import { fmtDateLong } from '../lib/data';
import { DEMO_TODAY } from '../lib/data';
import { coverage, coverageLabel, coverageTone, positionsOf, membersOf } from '../lib/crew';

export default function CrewTeamDetail() {
  const { teamId } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const team = (db.crewTeams ?? []).find((t) => t.id === teamId);
  if (!team) return <div className="empty" style={{ marginTop: 40 }}>Team not found.</div>;

  const positions = positionsOf(db, team.id);
  const members = membersOf(db, team.id);
  const leader = team.leaderPersonId ? db.people.find((p) => p.id === team.leaderPersonId) : null;
  const posName = (id: string) => db.crewPositions?.find((p) => p.id === id)?.name ?? '';
  const now = DEMO_TODAY.getTime();
  const upcoming = db.events
    .filter((e) => e.starts_at && (db.crewAssignments ?? []).some((a) => a.eventId === e.id && a.teamId === team.id))
    .filter((e) => new Date(e.starts_at!).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());

  return (
    <>
      <button className="back-link" onClick={() => nav('/teams')}><i className="ti ti-chevron-left" /> Teams</button>
      <h1 className="page-h" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className={'ti ' + (team.icon ?? 'ti-users-group')} style={{ color: 'var(--green)' }} /> {team.name}
      </h1>
      {team.blurb && <div className="page-sub">{team.blurb}</div>}
      {leader && <div className="page-sub" style={{ fontSize: 13 }}>Led by {leader.name}</div>}

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Positions</span>
        <span className="act">{positions.length}</span>
      </div>
      <div className="list">
        {positions.map((p, i) => {
          const qualified = members.filter((m) => m.positionIds.includes(p.id)).length;
          return (
            <div key={p.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <div className="row" style={{ cursor: 'default' }}>
                <span className="body">
                  <span className="title">{p.name}{p.slots && p.slots > 1 ? ` ×${p.slots}` : ''}</span>
                  <span className="sub">{qualified} qualified</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Members &amp; qualifications</span>
        <span className="act">{members.length}</span>
      </div>
      <div className="list">
        {members.map((m, i) => {
          const p = db.people.find((x) => x.id === m.personId);
          if (!p) return null;
          return (
            <div key={m.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
              <div className="space-row" style={{ cursor: 'default' }}>
                <span className="avatar">{initials(p.name)}</span>
                <span className="nm">
                  {p.name}
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}>
                    {m.positionIds.map(posName).filter(Boolean).join(' · ') || 'No positions yet'}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Upcoming</span>
        <span className="act">{upcoming.length}</span>
      </div>
      {upcoming.length === 0 && <div className="empty">No upcoming events rostered.</div>}
      <div className="list">
        {upcoming.map((e, i) => {
          const cov = coverage(db, e.id, team.id);
          return (
            <div key={e.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <button className="row" onClick={() => nav('/event/' + e.id)}>
                <span className="body">
                  <span className="title">{e.name}</span>
                  <span className="sub">{e.starts_at ? fmtDateLong(new Date(e.starts_at)) : ''}</span>
                </span>
                <span className={'cb-cov ' + coverageTone(cov)} style={{ marginRight: 6 }}>{coverageLabel(cov)}</span>
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
