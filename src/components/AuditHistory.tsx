import { useStore } from '../lib/store';
import { initials } from '../lib/session';
import { AUDIT_META, auditLog, auditTime } from '../lib/audit';

// Compact change history for a single record, shown inline on a detail page.
// Reads the same trail the /audit page does, filtered to one entity.
export default function AuditHistory({ entityId, limit = 6 }: { entityId: string; limit?: number }) {
  const { db } = useStore();
  const entries = auditLog(db).filter((e) => e.entityId === entityId).slice(0, limit);
  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="section-label">History</div>
      <div className="audit-list">
        {entries.map((e) => {
          const meta = AUDIT_META[e.entityType];
          return (
            <div key={e.id} className="audit-row" style={{ cursor: 'default' }}>
              <span className="audit-ico" style={{ background: 'color-mix(in srgb, ' + meta.color + ' 14%, transparent)', color: meta.color }}>
                <i className={'ti ' + meta.icon} />
              </span>
              <span className="audit-body">
                <span className="audit-top">
                  <span className="audit-action">{e.action}</span>
                  <span className="audit-time">{auditTime(e.at)}</span>
                </span>
                {e.detail && <span className="audit-detail">{e.detail}</span>}
                <span className="audit-actor">
                  <span className="audit-avatar">{initials(e.actor)}</span>
                  {e.actor}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
