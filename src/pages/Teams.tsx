import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { DEMO_TODAY } from '../lib/data';
import { coverage, coverageLabel, coverageTone } from '../lib/crew';
import type { Database, CrewTeam } from '../lib/types';

// The next event (today or later) that this team is rostered on, for the badge.
function nextEventFor(db: Database, teamId: string) {
  const now = DEMO_TODAY.getTime();
  const evs = db.events
    .filter((e) => e.starts_at && (db.crewAssignments ?? []).some((a) => a.eventId === e.id && a.teamId === teamId))
    .filter((e) => new Date(e.starts_at!).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime());
  return evs[0] ?? null;
}

export default function Teams() {
  const nav = useNavigate();
  const { db } = useStore();
  const teams = db.crewTeams ?? [];

  return (
    <>
      <h1 className="page-h">Teams</h1>
      <div className="page-sub">The people layer — who's committed to each event. Rooms live in Spaces; this is the crew.</div>

      <div style={{ height: 16 }} />
      {teams.length === 0 && <div className="empty">No teams yet.</div>}
      <div className="list">
        {teams.map((t: CrewTeam, i) => {
          const next = nextEventFor(db, t.id);
          const cov = next ? coverage(db, next.id, t.id) : null;
          const leader = t.leaderPersonId ? db.people.find((p) => p.id === t.leaderPersonId) : null;
          const memberCount = (db.crewMembers ?? []).filter((m) => m.teamId === t.id).length;
          return (
            <div key={t.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
              <button className="space-row" onClick={() => nav('/crew/' + t.id)}>
                <span className="space-ico"><i className={'ti ' + (t.icon ?? 'ti-users-group')} /></span>
                <span className="nm">
                  {t.name}
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}>
                    {memberCount} member{memberCount === 1 ? '' : 's'}{leader ? ` · led by ${leader.name.split(' ')[0]}` : ''}
                  </span>
                </span>
                {cov ? (
                  <span className={'cb-cov ' + coverageTone(cov)} style={{ marginRight: 6 }}>{coverageLabel(cov)}</span>
                ) : (
                  <span className="meta">—</span>
                )}
                <i className="ti chev ti-chevron-right" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
