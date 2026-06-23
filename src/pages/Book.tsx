import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { dayKey, DEMO_TODAY, fmtDateLong } from '../lib/data';
import { blackoutFor } from '../lib/calendar';
import { availableOn, resourceByName } from '../lib/stock';
import { field, primaryBtn } from '../components/Modal';
import { SetupDiagram, setupStyles } from '../components/SetupDiagram';
import TimeStepper from '../components/TimeStepper';
import type { Template } from '../lib/types';

// Step a YYYY-MM-DD key by n days, anchored at UTC noon so DST never shifts the date.
function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

const BUFFER_OPTS = [0, 15, 30, 45, 60, 90, 120];
function BufferSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        style={{ ...field, appearance: 'none', paddingRight: 30 }}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {BUFFER_OPTS.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? 'None' : `${m} min`}
          </option>
        ))}
      </select>
      <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 11, top: 13, color: 'var(--text-3)', pointerEvents: 'none' }} />
    </div>
  );
}

export default function Book() {
  const nav = useNavigate();
  const { db, addEvent, addEvents, addTemplate, removeTemplate } = useStore();
  const { user } = useSession();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [date, setDate] = useState(params.get('date') || dayKey(DEMO_TODAY));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [rooms, setRooms] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  // How many of each countable resource is requested (keyed by name).
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [setupStyle, setSetupStyle] = useState<string>('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(1);
  const [activeTpl, setActiveTpl] = useState<string>('');
  const [repeat, setRepeat] = useState<'none' | 'weekly' | 'biweekly'>('none');
  const [until, setUntil] = useState(addDaysKey(date, 56));
  // Setup/teardown buffers (minutes) reserve the room before/after the event.
  const [setupMin, setSetupMin] = useState(0);
  const [teardownMin, setTeardownMin] = useState(0);
  const [attendance, setAttendance] = useState('');
  // FSAutomation: have the building warm itself up before the event.
  const [climateHvac, setClimateHvac] = useState(false);
  const [climateLights, setClimateLights] = useState(false);
  const [preStartMin, setPreStartMin] = useState(60);
  const climateOn = climateHvac || climateLights;

  const isAdmin = user.site_admin;
  const templates = db.templates.filter((t) => t.door === 'book');

  // The concrete dates this booking lands on, given the repeat setting. One-off
  // bookings are just [date]; recurring ones step weekly/biweekly through `until`
  // (capped so a runaway range can't generate hundreds of events).
  const RECUR_CAP = 60;
  const effectiveUntil = until >= date ? until : addDaysKey(date, 56);
  const instances: string[] = (() => {
    if (repeat === 'none') return [date];
    const step = repeat === 'weekly' ? 7 : 14;
    const out: string[] = [];
    let k = date;
    while (k <= effectiveUntil && out.length < RECUR_CAP) {
      out.push(k);
      k = addDaysKey(k, step);
    }
    return out;
  })();
  const blackoutHits = instances.map((k) => ({ k, b: blackoutFor(k) })).filter((x) => x.b);
  const recurLabel =
    repeat === 'none'
      ? null
      : `${repeat === 'weekly' ? 'Weekly' : 'Every other week'} through ${fmtDateLong(new Date(effectiveUntil + 'T12:00'))}`;

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  // Selecting a countable resource defaults its requested count to 1; clearing
  // it drops the count too.
  function toggleResource(name: string) {
    const on = resources.includes(name);
    setResources(on ? resources.filter((x) => x !== name) : [...resources, name]);
    const r = resourceByName(db, name);
    if (r && typeof r.qty === 'number') {
      setQtys((prev) => {
        const next = { ...prev };
        if (on) delete next[name];
        else next[name] = next[name] ?? 1;
        return next;
      });
    }
  }

  function setQty(name: string, n: number) {
    setQtys((prev) => ({ ...prev, [name]: Math.max(1, n) }));
  }

  // Soft over-allocation check (per philosophy: warn, never block).
  const overdrawn = resources.filter((name) => {
    const q = qtys[name];
    if (!q) return false;
    const avail = availableOn(db, name, date);
    return avail !== null && q > avail;
  });

  // Capacity check: selected rooms whose capacity is below expected attendance.
  const headcount = parseInt(attendance, 10);
  const tooSmall =
    Number.isFinite(headcount) && headcount > 0
      ? rooms
          .map((n) => db.rooms.find((r) => r.name === n))
          .filter((r): r is NonNullable<typeof r> => !!r && typeof r.capacity === 'number' && headcount > r.capacity!)
      : [];

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
    // Recurring bookings share a seriesId so the whole run can later be moved /
    // cancelled together (item S4). One-off bookings get no series.
    const seriesId = instances.length > 1 ? `ser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` : undefined;
    const base = {
      name: name.trim(),
      all_day: false,
      setup_starts: null,
      teardown_ends: null,
      recurrence: recurLabel,
      seriesId,
      location: rooms[0] ?? null,
      owner: user.name,
      // Admins' own bookings auto-approve; everyone else lands in the queue.
      status: isAdmin ? 'Approved' : 'Pending',
      percent_approved: isAdmin ? 100 : 0,
      details: details.trim() || null,
      rooms,
      resources,
      // Only carry counts for resources still selected.
      resourceQty: Object.fromEntries(
        Object.entries(qtys).filter(([n]) => resources.includes(n)),
      ),
      setupStyle: setupStyle || undefined,
      expectedAttendance: Number.isFinite(headcount) && headcount > 0 ? headcount : undefined,
      climate: climateOn ? { hvac: climateHvac, lighting: climateLights, preStartMin } : undefined,
    };
    const payloads = instances.map((k) => {
      const s = new Date(`${k}T${start}`);
      const e = new Date(`${k}T${end}`);
      return {
        ...base,
        starts_at: s.toISOString(),
        ends_at: e.toISOString(),
        // Buffers reserve the room before/after; they feed conflict detection.
        setup_starts: setupMin > 0 ? new Date(s.getTime() - setupMin * 60000).toISOString() : null,
        teardown_ends: teardownMin > 0 ? new Date(e.getTime() + teardownMin * 60000).toISOString() : null,
      };
    });
    const created = payloads.length === 1 ? [addEvent(payloads[0])] : addEvents(payloads);
    setDoneCount(created.length);
    setDone(created[0].id);
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
          {doneCount > 1 ? (
            isAdmin
              ? `${doneCount} dates of ${name} are confirmed and on the calendar.`
              : `${doneCount} dates of ${name} are pending approval. You'll be notified once a space owner signs off.`
          ) : isAdmin
            ? `${name} is confirmed and on the calendar.`
            : `${name} is pending approval. You'll be notified once a space owner signs off.`}
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
      <input style={{ ...field, appearance: 'auto' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="flabel">Start time</label>
          <TimeStepper value={start} onChange={setStart} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="flabel">End time</label>
          <TimeStepper value={end} onChange={setEnd} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="flabel">Setup buffer</label>
          <BufferSelect value={setupMin} onChange={setSetupMin} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="flabel">Teardown buffer</label>
          <BufferSelect value={teardownMin} onChange={setTeardownMin} />
        </div>
      </div>
      {(setupMin > 0 || teardownMin > 0) && (
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '-2px 0 4px' }}>
          <i className="ti ti-clock-pause" style={{ marginRight: 5 }} />
          Room held {setupMin > 0 ? `${setupMin}m before` : ''}
          {setupMin > 0 && teardownMin > 0 ? ' and ' : ''}
          {teardownMin > 0 ? `${teardownMin}m after` : ''} — counts toward conflicts.
        </div>
      )}

      <label className="flabel" style={{ marginTop: 4 }}>Building automation</label>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
        Have the space ready before you walk in — auto-activate climate &amp; lighting ahead of the event, off at teardown.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={'chip' + (climateHvac ? ' on' : '')} onClick={() => setClimateHvac((v) => !v)}>
          <i className="ti ti-temperature" style={{ marginRight: 5 }} /> HVAC / climate
        </button>
        <button type="button" className={'chip' + (climateLights ? ' on' : '')} onClick={() => setClimateLights((v) => !v)}>
          <i className="ti ti-bulb" style={{ marginRight: 5 }} /> Lighting
        </button>
      </div>
      {climateOn && (
        <>
          <label className="flabel">Pre-start lead time</label>
          <BufferSelect value={preStartMin} onChange={setPreStartMin} />
          <div style={{ fontSize: 12.5, color: 'var(--green)', margin: '4px 0 2px' }}>
            <i className="ti ti-building-cog" style={{ marginRight: 5 }} />
            {[climateHvac ? 'Climate' : '', climateLights ? 'lighting' : ''].filter(Boolean).join(' + ')}
            {' '}on {preStartMin === 0 ? 'at start time' : `${preStartMin} min before`}
            {teardownMin > 0 ? `, off ${teardownMin} min after teardown` : ', off at teardown'}.
          </div>
        </>
      )}

      <label className="flabel">Repeats</label>
      <div className="seg seg-sm" style={{ marginBottom: repeat === 'none' ? 0 : 12 }}>
        <button className={repeat === 'none' ? 'active' : ''} onClick={() => setRepeat('none')}>
          Once
        </button>
        <button className={repeat === 'weekly' ? 'active' : ''} onClick={() => setRepeat('weekly')}>
          Weekly
        </button>
        <button className={repeat === 'biweekly' ? 'active' : ''} onClick={() => setRepeat('biweekly')}>
          Every 2 wks
        </button>
      </div>
      {repeat !== 'none' && (
        <>
          <label className="flabel">Repeat until</label>
          <input style={field} type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
          <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '2px 0 4px' }}>
            <i className="ti ti-repeat" style={{ marginRight: 5 }} />
            {recurLabel} · <b>{instances.length}</b> date{instances.length === 1 ? '' : 's'}
            {instances.length >= RECUR_CAP ? ` (capped at ${RECUR_CAP})` : ''}
          </div>
        </>
      )}

      {blackoutHits.length > 0 && (
        <div className="ins-card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-tint)', padding: '11px 13px', margin: '6px 0 2px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--warn)', fontWeight: 600, fontSize: 14 }}>
            <i className="ti ti-calendar-off" />
            {blackoutHits.length === 1
              ? `${fmtDateLong(new Date(blackoutHits[0].k + 'T12:00'))} is a no-school day`
              : `${blackoutHits.length} of these dates fall on no-school days`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 5 }}>
            {[...new Set(blackoutHits.map((h) => h.b!.label))].join(', ')}. You can still book — just confirming you meant to.
          </div>
        </div>
      )}

      <label className="flabel">Room{rooms.length > 0 ? ` · ${rooms.length} selected` : ''}</label>
      <div className="chips">
        {db.rooms.map((r) => (
          <button key={r.id} className={'chip' + (rooms.includes(r.name) ? ' on' : '')} onClick={() => toggle(rooms, setRooms, r.name)}>
            {r.name}
          </button>
        ))}
      </div>

      <label className="flabel">Expected attendance (optional)</label>
      <input
        style={field}
        type="number"
        min={1}
        inputMode="numeric"
        value={attendance}
        onChange={(e) => setAttendance(e.target.value)}
        placeholder="How many people?"
      />
      {rooms.some((n) => typeof db.rooms.find((r) => r.name === n)?.capacity === 'number') &&
        tooSmall.length === 0 &&
        Number.isFinite(headcount) &&
        headcount > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ok)', margin: '-2px 0 4px' }}>
            <i className="ti ti-users-group" style={{ marginRight: 5 }} />
            Fits in {rooms.length === 1 ? 'the room' : 'all selected rooms'}.
          </div>
        )}
      {tooSmall.length > 0 && (
        <div className="ins-card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-tint)', padding: '11px 13px', margin: '6px 0 2px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--warn)', fontWeight: 600, fontSize: 14 }}>
            <i className="ti ti-alert-triangle" />
            Over capacity
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 5 }}>
            {headcount} expected, but {tooSmall.map((r) => `${r.name} seats ${r.capacity}`).join(', ')}. You can still
            book — just confirming the space works.
          </div>
        </div>
      )}

      <label className="flabel">Resources{resources.length > 0 ? ` · ${resources.length} selected` : ''}</label>
      <div className="chips">
        {db.resources.map((r) => (
          <button
            key={r.id}
            className={'chip' + (resources.includes(r.name) ? ' on' : '')}
            onClick={() => toggleResource(r.name)}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Quantity + live availability for each selected countable resource. */}
      {resources.some((n) => typeof resourceByName(db, n)?.qty === 'number') && (
        <div className="qty-block">
          {resources
            .map((n) => resourceByName(db, n))
            .filter((r): r is NonNullable<typeof r> => !!r && typeof r.qty === 'number')
            .map((r) => {
              const q = qtys[r.name] ?? 1;
              const avail = availableOn(db, r.name, date);
              const short = avail !== null && q > avail;
              return (
                <div key={r.id} className="qty-row">
                  <span className="qty-name">{r.name}</span>
                  <div className="qty-step">
                    <button type="button" onClick={() => setQty(r.name, q - 1)} aria-label="less">
                      <i className="ti ti-minus" />
                    </button>
                    <span className="qty-n">{q}</span>
                    <button type="button" onClick={() => setQty(r.name, q + 1)} aria-label="more">
                      <i className="ti ti-plus" />
                    </button>
                  </div>
                  <span className="qty-avail" style={{ color: short ? 'var(--warn)' : 'var(--text-3)' }}>
                    {short ? (
                      <>
                        <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 3 }} />
                        {avail !== null && avail <= 0 ? `0 of ${r.qty} free` : `only ${avail} of ${r.qty} free`}
                      </>
                    ) : (
                      `${avail} of ${r.qty} free`
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {overdrawn.length > 0 && (
        <div className="ins-card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-tint)', padding: '11px 13px', margin: '10px 0 2px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--warn)', fontWeight: 600, fontSize: 14 }}>
            <i className="ti ti-alert-triangle" />
            Over-allocated for {fmtDateLong(new Date(date + 'T12:00'))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 5 }}>
            More {overdrawn.length === 1 ? overdrawn[0] : overdrawn.join(', ')} requested than is free that day. You can
            still book — just coordinate with whoever else holds them.
          </div>
        </div>
      )}

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
        {instances.length > 1 ? ` · ${instances.length} dates` : ''}
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
