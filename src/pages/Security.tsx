import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { initials } from '../lib/session';
import { DEMO_TODAY, dayKey, fmtDateLong, fmtTime } from '../lib/data';
import { schoolStatusAt, schoolHoursFor, hhmm, parseHHMM, shiftsOnDay, coverageGaps, afterHoursEvents, expectedOnCampus } from '../lib/security';
import { useVisitorLog, checkOutVisitor } from '../lib/visitorLog';
import LogVisitorModal from '../components/LogVisitorModal';

export default function Security() {
  const nav = useNavigate();
  const { db } = useStore();
  const [showLog, setShowLog] = useState(false);
  const today = dayKey(DEMO_TODAY);
  const nowHHMM = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(DEMO_TODAY);

  const status = schoolStatusAt(DEMO_TODAY);
  const window = schoolHoursFor(today);
  const shifts = shiftsOnDay(db, today);
  const gaps = coverageGaps(db, today);
  const afterHours = afterHoursEvents(db, today);
  const expected = expectedOnCampus(db, today);
  const visitors = useVisitorLog().filter((v) => v.date === today);
  const onCampusNow = visitors.filter((v) => !v.checkOutAt).length;

  const personName = (id: string) => db.people.find((p) => p.id === id)?.name ?? 'Guard';

  return (
    <>
      <h1 className="page-h">Security &amp; visitors</h1>
      <div className="page-sub">{fmtDateLong(DEMO_TODAY)} — the gate's day at a glance.</div>

      {/* School-Open status — the resource whose calendar defines operating hours. */}
      <div className={'sec-status ' + (status.open ? 'open' : 'closed')}>
        <span className="sec-status-dot" />
        <div>
          <div className="sec-status-t">{status.open ? 'Campus open' : 'Campus closed'}</div>
          <div className="sec-status-s">
            {window ? `School-Open hours today · ${hhmm(window.open)} – ${hhmm(window.close)}` : 'Closed all day'}
          </div>
        </div>
        <span className="sec-oncampus" title="Visitors signed in and not yet checked out">
          <i className="ti ti-user-check" /> {onCampusNow} on campus
        </span>
      </div>

      {/* Guard coverage — guards are people-resources on the Security calendar. */}
      <div className="section-label" style={{ marginTop: 24 }}>
        <span className="lbl">Guard coverage</span>
        {gaps.length > 0 && <span className="sec-gap-badge">{gaps.length} gap{gaps.length === 1 ? '' : 's'}</span>}
      </div>
      <div className="list">
        {shifts.map((s, i) => (
          <div key={s.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
            <div className="space-row" style={{ cursor: 'default' }}>
              <span className="avatar">{initials(personName(s.personId))}</span>
              <span className="nm">
                {personName(s.personId)}
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}>{s.post}</span>
              </span>
              <span className="sec-shift-time">{hhmm(parseHHMM(s.start))} – {hhmm(parseHHMM(s.end))}</span>
            </div>
          </div>
        ))}
        {shifts.length === 0 && <div className="empty">No guards scheduled today.</div>}
      </div>
      {gaps.map((g, i) => (
        <div key={i} className="sec-gap">
          <i className="ti ti-alert-triangle" />
          Coverage gap · {hhmm(g.start)} – {hhmm(g.end)} — no guard posted
        </div>
      ))}

      {/* After-hours bookings auto-flag "needs Security + Custodial." */}
      {afterHours.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>
            <span className="lbl">After-hours bookings</span>
            <span className="act">{afterHours.length}</span>
          </div>
          <div className="list">
            {afterHours.map(({ ev, reason }, i) => (
              <div key={ev.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <button className="row" onClick={() => nav('/event/' + ev.id)}>
                  <span className="body">
                    <span className="title">{ev.name}</span>
                    <span className="sub">{ev.rooms.join(', ')} · {reason}</span>
                  </span>
                  <span className="sec-flag"><i className="ti ti-shield-half" /> Security + Custodial</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pre-registered visitors — the heads-up that beats a cold walk-up. */}
      <div className="section-label" style={{ marginTop: 24 }}>
        <span className="lbl">Expected on campus</span>
        <span className="act">{expected.length}</span>
      </div>
      {expected.length === 0 && <div className="empty">No pre-registered visitors today.</div>}
      <div className="list">
        {expected.map((e, i) => (
          <div key={e.id}>
            {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
            <button className="row" onClick={() => nav('/event/' + e.id)}>
              <span className="body">
                <span className="title">{e.expectedVisitors?.contact ?? e.name} · {e.expectedVisitors?.count}</span>
                <span className="sub">
                  {e.expectedVisitors?.time && `${fmtTime(`${today}T${e.expectedVisitors.time}:00-04:00`)} · `}
                  {e.expectedVisitors?.purpose} · with {e.owner} · {e.rooms.join(', ')}
                </span>
              </span>
              <i className="ti chev ti-chevron-right" />
            </button>
          </div>
        ))}
      </div>

      {/* Native "Log a Visitor" — replaces the stray MS Form. Session-only. */}
      <div className="section-label" style={{ marginTop: 24 }}>
        <span className="lbl">Visitor log</span>
        <button className="rs-add" onClick={() => setShowLog(true)}><i className="ti ti-plus" /> Log a visitor</button>
      </div>
      <div className="vis-privacy small">
        <i className="ti ti-lock" /> Names are kept in this session only and never saved to disk — the log clears on reload.
      </div>
      {visitors.length === 0 && <div className="empty">No visitors signed in yet.</div>}
      <div className="list">
        {visitors.map((v, i) => {
          const ev = v.eventId ? db.events.find((e) => e.id === v.eventId) : null;
          return (
            <div key={v.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <div className="row" style={{ cursor: 'default' }}>
                <span className="body">
                  <span className="title">{v.names}{v.badge && <span className="vis-badge">#{v.badge}</span>}</span>
                  <span className="sub">
                    In {fmtTime(`${today}T${v.time}:00-04:00`)}
                    {v.checkOutAt ? ` · Out ${fmtTime(`${today}T${v.checkOutAt}:00-04:00`)}` : ''}
                    {' · '}{v.campus}{v.reason ? ` · ${v.reason}` : ''}
                    {v.overseerName ? ` · with ${v.overseerName}` : ''}
                    {ev ? ` · ${ev.name}` : ''}
                  </span>
                </span>
                {v.checkOutAt
                  ? <span className="vis-out">Checked out</span>
                  : <button className="vis-checkout" onClick={() => checkOutVisitor(v.id, nowHHMM)}>Check out</button>}
              </div>
            </div>
          );
        })}
      </div>

      {showLog && <LogVisitorModal onClose={() => setShowLog(false)} />}
      <div style={{ height: 24 }} />
    </>
  );
}
