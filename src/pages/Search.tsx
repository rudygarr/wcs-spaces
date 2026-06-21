import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { search, SEARCH_KIND_META, type SearchKind } from '../lib/search';

export default function Search() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | SearchKind>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => search(db, q, user), [db, q, user]);
  const shown = kind === 'all' ? results : results.filter((r) => r.kind === kind);

  // Filter chips only for kinds that actually matched.
  const present = Array.from(new Set(results.map((r) => r.kind)));
  const order: SearchKind[] = ['booking', 'work', 'rental', 'asset', 'person', 'room'];
  const chips: { id: 'all' | SearchKind; label: string }[] = [
    { id: 'all', label: `All ${results.length}` },
    ...order
      .filter((k) => present.includes(k))
      .map((k) => ({ id: k, label: `${SEARCH_KIND_META[k].label} ${results.filter((r) => r.kind === k).length}` })),
  ];

  return (
    <>
      <h1 className="page-h">Search</h1>
      <div className="search-field">
        <i className="ti ti-search" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Bookings, work orders, rentals, assets, people, spaces…"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {q && (
          <button className="search-clear" aria-label="Clear" onClick={() => setQ('')}>
            <i className="ti ti-x" />
          </button>
        )}
      </div>

      {q.trim().length < 2 ? (
        <div className="empty" style={{ marginTop: 24 }}>Type at least two characters to search across everything.</div>
      ) : (
        <>
          <div className="chips" style={{ marginTop: 14, marginBottom: 14 }}>
            {chips.map((c) => (
              <button key={c.id} className={'chip' + (kind === c.id ? ' on' : '')} onClick={() => setKind(c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="list">
            {shown.length === 0 && <div className="empty">No matches for “{q.trim()}”.</div>}
            {shown.map((r, i) => (
              <div key={r.kind + r.id}>
                {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
                <button className="space-row" onClick={() => nav(r.link.replace(/^#/, ''))}>
                  <span className="space-ico" style={{ background: 'color-mix(in srgb, ' + r.color + ' 14%, transparent)', color: r.color }}>
                    <i className={'ti ' + r.icon} />
                  </span>
                  <span className="nm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span style={{ fontWeight: 550 }}>{r.title}</span>
                    {r.sub && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.sub}</span>}
                  </span>
                  <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', marginRight: 6 }}>
                    {SEARCH_KIND_META[r.kind].label.replace(/s$/, '')}
                  </span>
                  <i className="ti ti-chevron-right chev" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
