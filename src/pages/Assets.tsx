import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { pmStatus, PM_META, pmDueDate, pmDueCount, type PMStatus } from '../lib/assets';
import { fmtDateLong } from '../lib/data';

const catIcons: Record<string, string> = {
  HVAC: 'ti-air-conditioning',
  AV: 'ti-device-tv',
  Safety: 'ti-urgent',
  Kitchen: 'ti-tools-kitchen-2',
  Athletics: 'ti-ball-basketball',
  IT: 'ti-device-laptop',
  Facilities: 'ti-building-factory-2',
};

export default function Assets() {
  const nav = useNavigate();
  const { db } = useStore();
  const [filter, setFilter] = useState<'all' | PMStatus>('all');

  const assets = db.assets ?? [];
  const due = pmDueCount(db);

  const shown = useMemo(() => {
    const list = filter === 'all' ? assets : assets.filter((a) => pmStatus(a) === filter);
    // Sort by urgency: overdue, due-soon, ok, none.
    const rank: Record<PMStatus, number> = { overdue: 0, 'due-soon': 1, ok: 2, none: 3 };
    return [...list].sort((a, b) => rank[pmStatus(a)] - rank[pmStatus(b)]);
  }, [assets, filter]);

  const chips: { id: 'all' | PMStatus; label: string }[] = [
    { id: 'all', label: `All ${assets.length}` },
    { id: 'overdue', label: `Overdue ${due.overdue}` },
    { id: 'due-soon', label: `Due soon ${due.soon}` },
    { id: 'ok', label: 'On track' },
  ];

  return (
    <>
      <h1 className="page-h">Assets &amp; maintenance</h1>
      <div className="page-sub">
        {assets.length} tracked assets · preventive maintenance schedules
      </div>

      <div className="chips" style={{ marginTop: 14, marginBottom: 14 }}>
        {chips.map((c) => (
          <button key={c.id} className={'chip' + (filter === c.id ? ' on' : '')} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="list">
        {shown.length === 0 && <div className="empty">No assets in this view.</div>}
        {shown.map((a, i) => {
          const st = pmStatus(a);
          const meta = PM_META[st];
          const due = pmDueDate(a);
          return (
            <div key={a.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
              <button className="space-row" onClick={() => nav('/asset/' + a.id)}>
                <span className="space-ico">
                  <i className={'ti ' + (catIcons[a.category] || 'ti-box')} />
                </span>
                <span className="nm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontWeight: 550 }}>{a.name}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                    {a.code} · {a.location}
                  </span>
                </span>
                <span
                  className="pill"
                  style={{ background: 'color-mix(in srgb, ' + meta.color + ' 14%, transparent)', color: meta.color, marginRight: 6 }}
                  title={due ? `Due ${fmtDateLong(due)}` : undefined}
                >
                  <i className={'ti ' + meta.icon} style={{ fontSize: 12, marginRight: 3 }} />
                  {meta.label}
                </span>
                <i className="ti ti-chevron-right chev" />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ height: 20 }} />
    </>
  );
}
