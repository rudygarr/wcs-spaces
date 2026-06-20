import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DEMO_TODAY,
  eventsOnDay,
  findConflicts,
  fmtTime,
  fmtDateLong,
  fmtDateShort,
  addDays,
  startOfWeek,
  dayKey,
  statusColor,
  isMine,
} from '../lib/data';
import { blackoutForDate } from '../lib/calendar';
import { buildICS, downloadICS } from '../lib/ics';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';

export default function Calendar() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [day, setDay] = useState<Date>(DEMO_TODAY);
  const [view, setView] = useState<'mine' | 'school'>('school');
  const dayEvents = eventsOnDay(db.events, day);
  const list = view === 'mine' ? dayEvents.filter((e) => isMine(e, user.name)) : dayEvents;
  const conflicts = findConflicts(dayEvents);
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));

  return (
    <>
      <div className="daynav">
        <button onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
          <i className="ti ti-chevron-left" />
        </button>
        <div className="label">{fmtDateLong(day)}</div>
        <button onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
          <i className="ti ti-chevron-right" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {week.map((d) => {
          const active = dayKey(d) === dayKey(day);
          const has = eventsOnDay(db.events, d).length;
          return (
            <button
              key={dayKey(d)}
              onClick={() => setDay(d)}
              style={{
                flex: 1,
                border: '0.5px solid var(--border)',
                background: active ? 'var(--green)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-1)',
                borderRadius: 'var(--r-md)',
                padding: '8px 0 7px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,.8)' : 'var(--text-3)' }}>
                {fmtDateShort(d).split(',')[0]}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }} className="tnum">
                {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' }).format(d)}
              </span>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 50,
                  background: has ? (active ? 'var(--gold)' : 'var(--green)') : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className="seg seg-sm" style={{ flex: 1 }}>
          <button className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}>
            Your events
          </button>
          <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>
            School events
          </button>
        </div>
        <button
          className="btn-soft"
          aria-label="Export to calendar"
          style={{ padding: '0 12px' }}
          onClick={() => {
            const evs =
              view === 'mine'
                ? db.events.filter((e) => isMine(e, user.name) && e.starts_at)
                : db.events.filter((e) => e.starts_at);
            downloadICS(view === 'mine' ? 'my-wcs-calendar' : 'wcs-school-calendar', buildICS(evs, view === 'mine' ? `${user.name} — WCS` : 'WCS School Calendar'));
          }}
        >
          <i className="ti ti-calendar-down" />
        </button>
        <button className="fab" onClick={() => nav('/book?date=' + dayKey(day))}>
          <i className="ti ti-plus" /> Book
        </button>
      </div>

      {blackoutForDate(day) && (
        <div className="banner" style={{ background: 'var(--info-tint, var(--surface-2))', borderColor: 'var(--info)', color: 'var(--info)' }}>
          <i className="ti ti-calendar-off" />
          <span>
            <b>No school</b> — {blackoutForDate(day)!.label}.
          </span>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="banner">
          <i className="ti ti-alert-triangle" />
          <span>
            <b>
              {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}
            </b>{' '}
            today — {conflicts[0].room} is double-booked.
          </span>
        </div>
      )}

      <div className="list">
        {list.length === 0 && view === 'mine' && (
          <button className="empty" style={{ width: '100%', background: 'none', border: 'none' }} onClick={() => setView('school')}>
            Nothing of yours this day — see school events →
          </button>
        )}
        {list.length === 0 && view === 'school' && <div className="empty">Nothing scheduled this day.</div>}
        {list.map((e, i) => {
          const conflicted = conflicts.some((c) => c.a === e || c.b === e);
          const notice = e.kind === 'notice';
          return (
            <div key={e.id}>
              {i > 0 && <div className="divider" />}
              <button className="row" onClick={() => nav('/event/' + e.id)}>
                <span className="time tnum">
                  {e.all_day ? (
                    'All day'
                  ) : (
                    <>
                      {fmtTime(e.starts_at)}
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtTime(e.ends_at)}</div>
                    </>
                  )}
                </span>
                <span
                  className="dot"
                  style={{ background: conflicted ? 'var(--warn)' : notice ? 'var(--info)' : statusColor(e.status) }}
                />
                <span className="body">
                  <span className="title" style={conflicted ? { color: 'var(--warn)' } : undefined}>
                    {conflicted && <i className="ti ti-alert-triangle" style={{ fontSize: 14, marginRight: 4 }} />}
                    {e.name}
                  </span>
                  <span className="sub">
                    {notice
                      ? e.location || (e.audience ? e.audience : 'No space booked')
                      : `${e.rooms.join(', ') || 'No room'}${e.owner ? ' · ' + e.owner : ''}`}
                  </span>
                  {e.resources.length > 0 && (
                    <span className="sub" style={{ color: 'var(--text-3)' }}>
                      <i className="ti ti-plug-connected" style={{ fontSize: 12, marginRight: 4 }} />
                      {e.resources.join(', ')}
                    </span>
                  )}
                  {(e.assignments?.length ?? 0) > 0 && (
                    <span className="sub" style={{ color: 'var(--text-3)' }}>
                      <i className="ti ti-users" style={{ fontSize: 12, marginRight: 4 }} />
                      {e.assignments!.map((a) => a.role).join(', ')}
                    </span>
                  )}
                </span>
                <span
                  className="pill"
                  style={{
                    background: conflicted
                      ? 'color-mix(in srgb, var(--warn) 16%, transparent)'
                      : notice
                        ? 'color-mix(in srgb, var(--info) 14%, transparent)'
                        : 'var(--surface-2)',
                    color: conflicted ? 'var(--warn)' : notice ? 'var(--info)' : statusColor(e.status),
                  }}
                >
                  {conflicted ? 'Conflict' : notice ? 'FYI' : e.status}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ height: 16 }} />
    </>
  );
}
