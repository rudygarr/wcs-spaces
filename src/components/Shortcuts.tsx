import { useNavigate } from 'react-router-dom';
import { pinnedShortcuts } from '../lib/dashboard';
import type { DashboardPrefs } from '../lib/types';

// The curated quick-link grid the user controls (see DashboardCustomizer).
export default function Shortcuts({ prefs, onCustomize }: { prefs?: DashboardPrefs; onCustomize: () => void }) {
  const nav = useNavigate();
  const tiles = pinnedShortcuts(prefs);

  return (
    <div className="sc-wrap">
      <div className="section-label">
        <span className="lbl">Shortcuts</span>
        <button className="sc-edit" onClick={onCustomize}><i className="ti ti-adjustments-horizontal" /> Customize</button>
      </div>
      {tiles.length === 0 ? (
        <button className="sc-empty" onClick={onCustomize}>
          <i className="ti ti-plus" /> Add shortcuts to your dashboard
        </button>
      ) : (
        <div className="sc-grid">
          {tiles.map((t) => (
            <button key={t.key} className="sc-tile" onClick={() => nav(t.route)}>
              <i className={'ti ' + t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
