import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { RunSheet as RunSheetT, RunSegment, RunCrewSlot, RunCue, CueDept } from '../lib/types';
import {
  blankSegment,
  blankSheet,
  rollTimes,
  fmtMin,
  fmtDur,
  totalRuntime,
  deriveStart,
  CUE_META,
  CUE_DEPTS,
  RUN_TEMPLATES,
} from '../lib/runsheet';
import type { RunTemplate } from '../lib/runsheet';

// The run-of-show editor. Run-of-show is the spine: a rolling clock of timed
// segments. Each segment expands into its own call sheet (crew) and cue sheet
// (tech cues) — the "all three in one" production document.
export default function RunSheet() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateEvent } = useStore();
  const ev = db.events.find((e) => e.id === id);

  const [draft, setDraft] = useState<RunSheetT>(() =>
    ev?.runSheet ? structuredClone(ev.runSheet) : blankSheet(ev ? deriveStart(ev) : '18:00'),
  );
  const [open, setOpen] = useState<string | null>(draft.segments[0]?.id ?? null);
  const [tplOpen, setTplOpen] = useState(false);

  if (!ev) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Event not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/calendar')}>
          Back to Calendar
        </button>
      </div>
    );
  }

  const rolled = rollTimes(draft);
  const total = totalRuntime(draft);

  // A sheet is "empty" when nothing meaningful has been typed yet — that's when
  // templates lead. Once there's real content they hide behind a quiet link.
  const isEmpty = draft.segments.every(
    (s) => !s.title.trim() && !(s.crew?.length ?? 0) && !(s.cues?.length ?? 0) && !s.notes?.trim(),
  );
  const applyTemplate = (t: RunTemplate) => {
    if (!isEmpty && !confirm(`Replace the current run sheet with the "${t.label}" template?`)) return;
    const segs = t.build();
    setDraft((d) => ({ ...d, segments: segs }));
    setOpen(segs[0]?.id ?? null);
    setTplOpen(false);
  };
  const showTpl = isEmpty || tplOpen;

  // ---- immutable draft mutators ----
  const setStart = (start: string) => setDraft((d) => ({ ...d, start }));
  const updSeg = (segId: string, fn: (s: RunSegment) => RunSegment) =>
    setDraft((d) => ({ ...d, segments: d.segments.map((s) => (s.id === segId ? fn(s) : s)) }));

  function addSeg() {
    const seg = blankSegment();
    setDraft((d) => ({ ...d, segments: [...d.segments, seg] }));
    setOpen(seg.id);
  }
  function removeSeg(segId: string) {
    setDraft((d) => ({ ...d, segments: d.segments.filter((s) => s.id !== segId) }));
  }
  function moveSeg(segId: string, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.segments.findIndex((s) => s.id === segId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.segments.length) return d;
      const segs = [...d.segments];
      [segs[i], segs[j]] = [segs[j], segs[i]];
      return { ...d, segments: segs };
    });
  }

  // crew (call sheet)
  const addCrew = (segId: string) =>
    updSeg(segId, (s) => ({ ...s, crew: [...(s.crew ?? []), { role: '', person: '' }] }));
  const patchCrew = (segId: string, idx: number, patch: Partial<RunCrewSlot>) =>
    updSeg(segId, (s) => ({ ...s, crew: (s.crew ?? []).map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  const removeCrew = (segId: string, idx: number) =>
    updSeg(segId, (s) => ({ ...s, crew: (s.crew ?? []).filter((_, i) => i !== idx) }));

  // cues (cue sheet)
  const addCue = (segId: string) =>
    updSeg(segId, (s) => ({ ...s, cues: [...(s.cues ?? []), { dept: 'AUD' as CueDept, action: '' }] }));
  const patchCue = (segId: string, idx: number, patch: Partial<RunCue>) =>
    updSeg(segId, (s) => ({ ...s, cues: (s.cues ?? []).map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));
  const removeCue = (segId: string, idx: number) =>
    updSeg(segId, (s) => ({ ...s, cues: (s.cues ?? []).filter((_, i) => i !== idx) }));

  const save = () => {
    // Drop fully-empty trailing segments (no title and no content).
    const segments = draft.segments.filter(
      (s) => s.title.trim() || (s.crew?.length ?? 0) || (s.cues?.length ?? 0) || s.notes?.trim(),
    );
    updateEvent(ev.id, { runSheet: { ...draft, segments } });
    nav(`/event/${ev.id}`);
  };
  const clearSheet = () => {
    if (!confirm('Remove the run sheet from this event? This cannot be undone here.')) return;
    updateEvent(ev.id, { runSheet: undefined });
    nav(`/event/${ev.id}`);
  };

  return (
    <>
      <button className="back-link" onClick={() => nav(`/event/${ev.id}`)}>
        <i className="ti ti-chevron-left" /> {ev.name}
      </button>

      <h1 className="page-h" style={{ marginTop: 6 }}>
        Run of show
      </h1>
      <div className="page-sub" style={{ marginTop: 2 }}>
        Times roll from the start — change a segment's length and everything after it shifts.
      </div>

      <div className="ros-startbar">
        <span className="ros-startlbl">
          <i className="ti ti-flag-3" /> Show starts
        </span>
        <input type="time" className="ros-startinput" value={draft.start} onChange={(e) => setStart(e.target.value)} />
        <span className="ros-starttot">
          {draft.segments.length} segs · {fmtDur(total)}
        </span>
      </div>

      {showTpl ? (
        <div className="ros-tpl">
          <div className="ros-tpl-head">
            <span>
              <i className="ti ti-template" /> Start from a template
            </span>
            {!isEmpty && (
              <button className="ros-tpl-close" onClick={() => setTplOpen(false)} title="Close">
                <i className="ti ti-x" />
              </button>
            )}
          </div>
          <div className="ros-tpl-grid">
            {RUN_TEMPLATES.map((t) => (
              <button key={t.id} className="ros-tpl-card" onClick={() => applyTemplate(t)}>
                <i className={'ti ' + t.icon} />
                <span className="ros-tpl-label">{t.label}</span>
                <span className="ros-tpl-blurb">{t.blurb}</span>
              </button>
            ))}
          </div>
          {isEmpty && <div className="ros-tpl-foot">…or just add segments below by hand.</div>}
        </div>
      ) : (
        <button className="ros-tpl-link" onClick={() => setTplOpen(true)}>
          <i className="ti ti-template" /> Start from a template
        </button>
      )}

      <div className="ros-list">
        {draft.segments.map((seg, i) => {
          const row = rolled[i];
          const isOpen = open === seg.id;
          const crewN = seg.crew?.length ?? 0;
          const cueN = seg.cues?.length ?? 0;
          return (
            <div className="ros-seg" key={seg.id}>
              <div className="ros-seg-main">
                <div className="ros-time">
                  <span className="ros-time-start">{fmtMin(row.startMin)}</span>
                  <span className="ros-time-dur">{fmtDur(seg.durationMin)}</span>
                </div>
                <div className="ros-fields">
                  <input
                    className="ros-title-input"
                    placeholder="Segment name"
                    value={seg.title}
                    onChange={(e) => updSeg(seg.id, (s) => ({ ...s, title: e.target.value }))}
                  />
                  <div className="ros-row2">
                    <label className="ros-durwrap">
                      <input
                        type="number"
                        min={0}
                        className="ros-dur-input"
                        value={seg.durationMin}
                        onChange={(e) => updSeg(seg.id, (s) => ({ ...s, durationMin: Math.max(0, Number(e.target.value) || 0) }))}
                      />
                      min
                    </label>
                    <input
                      className="ros-who-input"
                      placeholder="Lead / quick note"
                      value={seg.who ?? ''}
                      onChange={(e) => updSeg(seg.id, (s) => ({ ...s, who: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="ros-seg-tools">
                  <button className="ros-iconbtn" disabled={i === 0} onClick={() => moveSeg(seg.id, -1)} title="Move up">
                    <i className="ti ti-chevron-up" />
                  </button>
                  <button
                    className="ros-iconbtn"
                    disabled={i === draft.segments.length - 1}
                    onClick={() => moveSeg(seg.id, 1)}
                    title="Move down"
                  >
                    <i className="ti ti-chevron-down" />
                  </button>
                  <button className="ros-iconbtn ros-del" onClick={() => removeSeg(seg.id)} title="Delete segment">
                    <i className="ti ti-trash" />
                  </button>
                </div>
              </div>

              <button className="ros-expand" onClick={() => setOpen(isOpen ? null : seg.id)}>
                <i className={'ti ' + (isOpen ? 'ti-chevron-down' : 'ti-chevron-right')} />
                Crew &amp; cues
                {(crewN > 0 || cueN > 0) && (
                  <span className="ros-expand-badges">
                    {crewN > 0 && (
                      <span className="ros-mini">
                        <i className="ti ti-users" /> {crewN}
                      </span>
                    )}
                    {cueN > 0 && (
                      <span className="ros-mini">
                        <i className="ti ti-bolt" /> {cueN}
                      </span>
                    )}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="ros-body">
                  <textarea
                    className="ros-notes"
                    placeholder="Notes for this segment…"
                    rows={2}
                    value={seg.notes ?? ''}
                    onChange={(e) => updSeg(seg.id, (s) => ({ ...s, notes: e.target.value }))}
                  />

                  {/* Call sheet */}
                  <div className="ros-sub-h">
                    <i className="ti ti-users" /> Crew
                  </div>
                  {(seg.crew ?? []).map((c, ci) => (
                    <div className="ros-crew-row" key={ci}>
                      <input
                        className="ros-in ros-in-role"
                        placeholder="Role"
                        value={c.role}
                        onChange={(e) => patchCrew(seg.id, ci, { role: e.target.value })}
                      />
                      <input
                        className="ros-in ros-in-person"
                        placeholder="Person"
                        value={c.person}
                        onChange={(e) => patchCrew(seg.id, ci, { person: e.target.value })}
                      />
                      <input
                        type="time"
                        className="ros-in ros-in-call"
                        title="Call time"
                        value={c.call ?? ''}
                        onChange={(e) => patchCrew(seg.id, ci, { call: e.target.value })}
                      />
                      <button className="ros-iconbtn ros-del" onClick={() => removeCrew(seg.id, ci)}>
                        <i className="ti ti-x" />
                      </button>
                    </div>
                  ))}
                  <button className="ros-addrow" onClick={() => addCrew(seg.id)}>
                    <i className="ti ti-plus" /> Add crew
                  </button>

                  {/* Cue sheet */}
                  <div className="ros-sub-h" style={{ marginTop: 12 }}>
                    <i className="ti ti-bolt" /> Tech cues
                  </div>
                  {(seg.cues ?? []).map((q, qi) => (
                    <div className="ros-cue-row" key={qi}>
                      <select
                        className="ros-in ros-in-dept"
                        value={q.dept}
                        onChange={(e) => patchCue(seg.id, qi, { dept: e.target.value as CueDept })}
                        style={{ color: CUE_META[q.dept].color }}
                      >
                        {CUE_DEPTS.map((d) => (
                          <option key={d} value={d}>
                            {CUE_META[d].label}
                          </option>
                        ))}
                      </select>
                      <input
                        className="ros-in ros-in-cue"
                        placeholder="Cue action — e.g. Mic 1 live, roll slides"
                        value={q.action}
                        onChange={(e) => patchCue(seg.id, qi, { action: e.target.value })}
                      />
                      <button className="ros-iconbtn ros-del" onClick={() => removeCue(seg.id, qi)}>
                        <i className="ti ti-x" />
                      </button>
                    </div>
                  ))}
                  <button className="ros-addrow" onClick={() => addCue(seg.id)}>
                    <i className="ti ti-plus" /> Add cue
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="ros-add" onClick={addSeg}>
        <i className="ti ti-plus" /> Add segment
      </button>

      <div className="ros-foot">
        Ends about <strong>{fmtMin(rolled.length ? rolled[rolled.length - 1].endMin : 0)}</strong> · total runtime{' '}
        {fmtDur(total)}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="fab" style={{ flex: 1, justifyContent: 'center' }} onClick={save}>
          <i className="ti ti-check" /> Save run sheet
        </button>
        <button className="btn-soft" style={{ justifyContent: 'center' }} onClick={() => nav(`/event/${ev.id}`)}>
          Cancel
        </button>
      </div>
      {ev.runSheet && (
        <button className="btn-soft" style={{ marginTop: 10, color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={clearSheet}>
          <i className="ti ti-trash" /> Remove run sheet
        </button>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
