import { useState } from 'react';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { SHORTCUTS, SECTIONS, DEFAULT_SHORTCUTS, shortcutDef } from '../lib/dashboard';
import type { DashboardPrefs } from '../lib/types';
import Modal, { primaryBtn } from './Modal';

// Edit the Home dashboard: pin/unpin shortcut tiles, reorder them, and hide or
// show the standing sections. Saves to the person record so it persists per user.
export default function DashboardCustomizer({ prefs, onClose }: { prefs?: DashboardPrefs; onClose: () => void }) {
  const { updatePerson } = useStore();
  const { user, setUser } = useSession();

  const [pinned, setPinned] = useState<string[]>(prefs?.shortcuts ?? DEFAULT_SHORTCUTS);
  const [hidden, setHidden] = useState<string[]>(prefs?.hiddenSections ?? []);

  const unpinned = SHORTCUTS.filter((s) => !pinned.includes(s.key));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    setPinned(next);
  }
  function toggleSection(key: string) {
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }
  function save() {
    const dashboard: DashboardPrefs = { shortcuts: pinned, hiddenSections: hidden };
    updatePerson(user.id, { dashboard });
    // Reflect immediately in the session snapshot so Home re-renders updated.
    setUser({ ...user, dashboard });
    onClose();
  }

  return (
    <Modal title="Customize dashboard" onClose={onClose}>
      <div className="dc-label">Pinned shortcuts <span>drag-free reorder with the arrows</span></div>
      <div className="dc-pinned">
        {pinned.length === 0 && <div className="inv-empty" style={{ margin: '4px 0' }}>None pinned yet — add some below.</div>}
        {pinned.map((key, i) => {
          const d = shortcutDef(key);
          if (!d) return null;
          return (
            <div key={key} className="dc-row">
              <i className={'ti ' + d.icon + ' dc-row-ic'} />
              <span className="dc-row-name">{d.label}</span>
              <div className="dc-arrows">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Up"><i className="ti ti-chevron-up" /></button>
                <button disabled={i === pinned.length - 1} onClick={() => move(i, 1)} aria-label="Down"><i className="ti ti-chevron-down" /></button>
              </div>
              <button className="dc-remove" onClick={() => setPinned(pinned.filter((k) => k !== key))} aria-label="Remove"><i className="ti ti-x" /></button>
            </div>
          );
        })}
      </div>

      {unpinned.length > 0 && (
        <>
          <div className="dc-label" style={{ marginTop: 16 }}>Add a shortcut</div>
          <div className="dc-add">
            {unpinned.map((s) => (
              <button key={s.key} className="dc-add-chip" onClick={() => setPinned([...pinned, s.key])}>
                <i className={'ti ' + s.icon} /> {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="dc-label" style={{ marginTop: 18 }}>Sections</div>
      <div className="dc-sections">
        {SECTIONS.map((s) => {
          const on = !hidden.includes(s.key);
          return (
            <button key={s.key} className={'dc-toggle' + (on ? ' on' : '')} onClick={() => toggleSection(s.key)}>
              <i className={'ti ' + (on ? 'ti-eye' : 'ti-eye-off')} />
              <span>{s.label}</span>
              <span className="dc-toggle-state">{on ? 'Shown' : 'Hidden'}</span>
            </button>
          );
        })}
      </div>

      <button style={{ ...primaryBtn, marginTop: 18 }} onClick={save}>Save dashboard</button>
    </Modal>
  );
}
