import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { AUDIT_META, auditLog, auditTime } from '../lib/audit';
import { initials } from '../lib/session';
import type { AuditEntityType } from '../lib/types';

export default function Audit() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [filter, setFilter] = useState<'all' | AuditEntityType>('all');

  const canView = user.site_admin;
  const log = useMemo(() => auditLog(db), [db]);

  if (!canView) {
    return (
      <>
        <h1 className="page-h">Activity log</h1>
        <div className="empty" style={{ marginTop: 20 }}>The audit trail is visible to administrators.</div>
      </>
    );
  }

  const shown = filter === 'all' ? log : log.filter((e) => e.entityType === filter);
  // Only offer filter chips for types that actually appear.
  const present = Array.from(new Set(log.map((e) => e.entityType)));
  const order: AuditEntityType[] = ['rental', 'booking', 'approval', 'work', 'asset', 'conflict', 'system'];
  const chips: { id: 'all' | AuditEntityType; label: string }[] = [
    { id: 'all', label: `All ${log.length}` },
    ...order
      .filter((t) => present.includes(t))
      .map((t) => ({ id: t, label: `${AUDIT_META[t].label} ${log.filter((e) => e.entityType === t).length}` })),
  ];

  return (
    <>
      <h1 className="page-h">Activity log</h1>
      <div className="page-sub">Who changed what, across bookings, rentals, work orders &amp; assets</div>

      <div className="chips" style={{ marginTop: 14, marginBottom: 14 }}>
        {chips.map((c) => (
          <button key={c.id} className={'chip' + (filter === c.id ? ' on' : '')} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="audit-list">
        {shown.length === 0 && <div className="empty">No activity in this view.</div>}
        {shown.map((e) => {
          const meta = AUDIT_META[e.entityType];
          const clickable = !!e.link;
          return (
            <button
              key={e.id}
              className="audit-row"
              disabled={!clickable}
              style={clickable ? undefined : { cursor: 'default' }}
              onClick={() => clickable && nav(e.link!.replace(/^#/, ''))}
            >
              <span className="audit-ico" style={{ background: 'color-mix(in srgb, ' + meta.color + ' 14%, transparent)', color: meta.color }}>
                <i className={'ti ' + meta.icon} />
              </span>
              <span className="audit-body">
                <span className="audit-top">
                  <span className="audit-action">{e.action}</span>
                  <span className="audit-time">{auditTime(e.at)}</span>
                </span>
                <span className="audit-label">{e.entityLabel}</span>
                {e.detail && <span className="audit-detail">{e.detail}</span>}
                <span className="audit-actor">
                  <span className="audit-avatar">{initials(e.actor)}</span>
                  {e.actor}
                </span>
              </span>
              {clickable && <i className="ti ti-chevron-right chev" />}
            </button>
          );
        })}
      </div>

      <div className="page-sub" style={{ marginTop: 16, fontSize: 12 }}>
        Demo trail recorded client-side under the “view as” user. Production would write server-side, tamper-evident, with retention &amp; export.
      </div>
      <div style={{ height: 20 }} />
    </>
  );
}
