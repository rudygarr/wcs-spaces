import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { startOfWeek, addDays, eventsOnDay, fmtTime, fmtDateLong, fmtDateShort, shortTeam, DEMO_TODAY } from '../lib/data';

export default function AthleticsWeek() {
  const { db } = useStore();
  const nav = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(DEMO_TODAY));

  const athletic = useMemo(() => db.events.filter((e) => e.category === 'Athletics' && e.starts_at), [db.events]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, events: eventsOnDay(athletic, date) };
      }).filter((d) => d.events.length > 0),
    [athletic, weekStart],
  );

  const total = days.reduce((n, d) => n + d.events.length, 0);
  const range = `${fmtDateShort(weekStart)} – ${fmtDateShort(addDays(weekStart, 6))}`;

  return (
    <>
      <h1 className="page-h">Athletics</h1>
      <div className="page-sub">This week’s games — auto-generated, no Monday email.</div>

      <div className="weeknav">
        <button className="weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
          <i className="ti ti-chevron-left" />
        </button>
        <div className="weeknav-label">
          <div style={{ fontSize: 15, fontWeight: 600 }}>{range}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{total} event{total === 1 ? '' : 's'}</div>
        </div>
        <button className="weeknav-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
          <i className="ti ti-chevron-right" />
        </button>
      </div>

      <button className="fab" style={{ width: '100%', justifyContent: 'center', marginBottom: 18 }} onClick={() => nav('/requests?door=athletics')}>
        <i className="ti ti-plus" /> Schedule an athletics event
      </button>

      {days.length === 0 ? (
        <div className="empty-card">
          <i className="ti ti-ball-basketball" style={{ fontSize: 26, color: 'var(--text-3)' }} />
          <div style={{ marginTop: 8 }}>No athletics scheduled this week.</div>
          <button className="btn-soft" style={{ marginTop: 14 }} onClick={() => setWeekStart(startOfWeek(DEMO_TODAY))}>
            Jump to current week
          </button>
        </div>
      ) : (
        days.map(({ date, events }) => (
          <div key={date.toISOString()} style={{ marginBottom: 18 }}>
            <div className="ath-day">{fmtDateLong(date)}</div>
            <div className="card">
              {events.map((e, i) => {
                const headTeam = shortTeam(e.team) || e.name;
                const sub = e.opponent ? `vs ${e.opponent}` : e.team && e.name !== e.team ? e.name : null;
                return (
                  <button key={e.id} className="ath-game" onClick={() => nav('/event/' + e.id)}>
                    <div className="ath-row1">
                      <span className="ath-team">{headTeam}</span>
                      <span className="ath-time">{e.all_day ? 'All day' : fmtTime(e.starts_at)}</span>
                    </div>
                    <div className="ath-row2">
                      {e.homeAway && (
                        <span className={'ha-tag ' + (e.homeAway === 'Home' ? 'home' : 'away')}>
                          <i className={'ti ' + (e.homeAway === 'Home' ? 'ti-home' : 'ti-bus')} /> {e.homeAway}
                        </span>
                      )}
                      {sub && <span className="ath-sub">{sub}</span>}
                      {e.location && <span className="ath-loc">· {e.location}</span>}
                    </div>
                    {(e.earlyDismissal || e.transportation) && (
                      <div className="ath-row3">
                        {e.earlyDismissal && (
                          <span className="ath-chip">
                            <i className="ti ti-school" /> Dismiss {e.earlyDismissal}
                          </span>
                        )}
                        {e.transportation && (
                          <span className="ath-chip">
                            <i className="ti ti-bus" /> {e.transportation}
                          </span>
                        )}
                      </div>
                    )}
                    {i < events.length - 1 && <div className="divider" style={{ marginTop: 12, marginLeft: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
      <div style={{ height: 16 }} />
    </>
  );
}
