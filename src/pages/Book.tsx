import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { dayKey, DEMO_TODAY } from '../lib/data';
import { field, primaryBtn } from '../components/Modal';
import { SetupDiagram, setupStyles } from '../components/SetupDiagram';
import type { Template } from '../lib/types';

// 6:00 a.m. → 9:00 p.m. in 15-min steps for the time dropdowns.
const TIME_OPTS: { v: string; label: string }[] = [];
for (let h = 6; h <= 21; h++) {
  for (const m of [0, 15, 30, 45]) {
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hr = h % 12 === 0 ? 12 : h % 12;
    TIME_OPTS.push({ v, label: `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}` });
  }
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = TIME_OPTS.some((t) => t.v === value);
  return (
    <div style={{ position: 'relative' }}>
      <select style={{ ...field, appearance: 'none', paddingRight: 30 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && value && <option value={value}>{value}</option>}
        {TIME_OPTS.map((t) => (
          <option key={t.v} value={t.v}>
            {t.label}
          </option>
        ))}
      </select>
      <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 11, top: 13, color: 'var(--text-3)', pointerEvents: 'none' }} />
    </div>
  );
}

export default function Book() {
  const nav = useNavigate();
  const { db, addEvent, addTemplate, removeTemplate } = useStore();
  const { user } = useSession();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [date, setDate] = useState(params.get('date') || dayKey(DEMO_TODAY));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [rooms, setRooms] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [setupStyle, setSetupStyle] = useState<string>('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [activeTpl, setActiveTpl] = useState<string>('');

  const isAdmin = user.site_admin;
  const templates = db.templates.filter((t) => t.door === 'book');

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  // Tapping a template fills everything in — the requester just picks date/time.
  function applyTemplate(t: Template) {
    if (activeTpl === t.id) {
      setActiveTpl('');
      return;
    }
    setActiveTpl(t.id);
    if (!name.trim()) setName(t.name);
    setRooms(t.rooms ?? []);
    setResources(t.resources ?? []);
    setSetupStyle(t.setupStyle ?? '');
    if (t.details) setDetails(t.details);
  }

  // Save the current selection as a reusable template.
  function saveAsTemplate() {
    const tn = window.prompt('Name this template', name.trim() || 'My setup');
    if (!tn) return;
    addTemplate({
      door: 'book',
      name: tn.trim(),
      rooms,
      resources,
      setupStyle: setupStyle || undefined,
      details: details.trim() || undefined,
    });
  }

  function submit() {
    if (!name.trim() || rooms.length === 0) return;
    const starts = new Date(`${date}T${start}`).toISOString();
    const ends = new Date(`${date}T${end}`).toISOString();
    const ev = addEvent({
      name: name.trim(),
      starts_at: starts,
      ends_at: ends,
      all_day: false,
      setup_starts: null,
      teardown_ends: null,
      recurrence: null,
      location: rooms[0] ?? null,
      owner: user.name,
      // Admins' own bookings auto-approve; everyone else lands in the queue.
      status: isAdmin ? 'Approved' : 'Pending',
      percent_approved: isAdmin ? 100 : 0,
      details: details.trim() || null,
      rooms,
      resources,
      setupStyle: setupStyle || undefined,
    });
    setDone(ev.id);
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 50 }}>
        <i
          className={'ti ' + (isAdmin ? 'ti-circle-check' : 'ti-clock-hour-4')}
          style={{ fontSize: 56, color: isAdmin ? 'var(--ok)' : 'var(--warn)' }}
        />
        <h1 className="page-h" style={{ marginTop: 14 }}>
          {isAdmin ? 'Booked' : 'Request sent'}
        </h1>
        <div className="page-sub" style={{ maxWidth: 320, margin: '0 auto 26px' }}>
          {isAdmin
            ? `${name} is confirmed and on the calendar.`
            : `${name} is pending approval. You'll be notified once a space admin signs off.`}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-soft" onClick={() => nav('/event/' + done)}>
            View booking
          </button>
          <button className="fab" onClick={() => nav('/calendar?date=' + date)}>
            Open calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-h">Book a space</h1>
      <div className="page-sub">
        Booking as <b style={{ color: 'var(--text-1)' }}>{user.name}</b> ·{' '}
        {isAdmin ? 'auto-approved' : 'needs approval'}
      </div>

      {templates.length > 0 && (
        <>
          <label className="flabel">Start from a template</label>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
            Tap one to fill in the room, setup, and gear — then just pick a date.
          </div>
          <div className="tpl-row">
            {templates.map((t) => (
              <button key={t.id} type="button" className={'tpl-chip' + (activeTpl === t.id ? ' on' : '')} onClick={() => applyTemplate(t)}>
                <i className="ti ti-bookmark" />
                <span>{t.name}</span>
                {!t.builtIn && (
                  <i
                    className="ti ti-x tpl-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete the "${t.name}" template?`)) {
                        if (activeTpl === t.id) setActiveTpl('');
                        removeTemplate(t.id);
                      }
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="flabel">Event name</label>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Booster Club meeting" autoFocus />

      <label className="flabel">Date</label>
      <input style={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="flabel">Start</label>
          <TimeSelect value={start} onChange={setStart} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="flabel">End</label>
          <TimeSelect value={end} onChange={setEnd} />
        </div>
      </div>

      <label className="flabel">Room{rooms.length > 0 ? ` · ${rooms.length} selected` : ''}</label>
      <div className="chips">
        {db.rooms.map((r) => (
          <button key={r.id} className={'chip' + (rooms.includes(r.name) ? ' on' : '')} onClick={() => toggle(rooms, setRooms, r.name)}>
            {r.name}
          </button>
        ))}
      </div>

      <label className="flabel">Resources{resources.length > 0 ? ` · ${resources.length} selected` : ''}</label>
      <div className="chips">
        {db.resources.map((r) => (
          <button
            key={r.id}
            className={'chip' + (resources.includes(r.name) ? ' on' : '')}
            onClick={() => toggle(resources, setResources, r.name)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <label className="flabel">Room setup{setupStyle ? '' : ' (optional)'}</label>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
        Tap the layout the setup crew should build — the picture goes on the work order, no guesswork.
      </div>
      <div className="setup-grid">
        {setupStyles.map((s) => (
          <button
            key={s.id}
            type="button"
            className={'setup-card' + (setupStyle === s.id ? ' sel' : '')}
            onClick={() => setSetupStyle(setupStyle === s.id ? '' : s.id)}
          >
            <span className="sd-frame">
              <SetupDiagram id={s.id} />
            </span>
            <span className="setup-name">{s.name}</span>
          </button>
        ))}
      </div>

      <label className="flabel" style={{ marginTop: 18 }}>Notes</label>
      <textarea
        style={{ ...field, height: 76, padding: '10px 12px', resize: 'vertical' }}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Setup needs, headcount, anything the approver should know"
      />

      <button
        style={{ ...primaryBtn, marginTop: 22, opacity: !name.trim() || rooms.length === 0 ? 0.5 : 1 }}
        onClick={submit}
        disabled={!name.trim() || rooms.length === 0}
      >
        {isAdmin ? 'Book it' : 'Send request'}
      </button>

      {rooms.length > 0 && (
        <button className="btn-soft" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={saveAsTemplate}>
          <i className="ti ti-bookmark-plus" /> Save this as a template
        </button>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
