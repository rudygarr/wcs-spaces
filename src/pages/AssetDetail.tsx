import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { pmStatus, PM_META, pmDueDate, pmDaysLeft } from '../lib/assets';
import { fmtDateLong, DEMO_TODAY } from '../lib/data';

// A decorative QR-style tag rendered from the asset code. It's a deterministic
// pattern (not a real scannable QR — that's a production library) that gives the
// asset a physical-tag identity for the registry.
function AssetTag({ code }: { code: string }) {
  const N = 11;
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const dataBit = (x: number, y: number) =>
    ((Math.imul(h ^ (x * 73856093) ^ (y * 19349663), 2654435761) >>> 13) & 1) === 1;
  // Three 3×3 finder squares (TL, TR, BL) for the QR look; data fills the rest.
  const inFinder = (x: number, y: number) =>
    (x < 3 && y < 3) || (x >= N - 3 && y < 3) || (x < 3 && y >= N - 3);
  const cells = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const on = inFinder(x, y) ? true : dataBit(x, y);
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} width={92} height={92} style={{ background: '#fff', borderRadius: 8 }}>
      <g fill="#111">{cells}</g>
    </svg>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, logService, addWorkItem } = useStore();
  const { user } = useSession();
  const a = (db.assets ?? []).find((x) => x.id === id);

  if (!a) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Asset not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/assets')}>
          Back to Assets
        </button>
      </div>
    );
  }

  const canService = user.site_admin || user.department === 'Maintenance';
  const st = pmStatus(a);
  const meta = PM_META[st];
  const due = pmDueDate(a);
  const left = pmDaysLeft(a);

  function createWorkOrder() {
    if (!a) return;
    const w = addWorkItem({
      department: 'Maintenance',
      type: 'Preventive maintenance',
      title: `${a.pmTask || 'Service'} — ${a.name}`,
      requestedBy: user.name,
      createdAt: DEMO_TODAY.toISOString(),
      status: 'New',
      priority: st === 'overdue' ? 'High' : 'Normal',
      location: a.location,
      details: `Scheduled PM for asset ${a.code}. ${a.pmTask || ''}`.trim(),
    });
    nav('/work/' + w.id);
  }

  return (
    <>
      <button className="back-link" onClick={() => nav(-1)}>
        <i className="ti ti-chevron-left" /> Back
      </button>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6 }}>
        <AssetTag code={a.code} />
        <div>
          <h1 className="page-h" style={{ marginBottom: 4 }}>{a.name}</h1>
          <div className="page-sub" style={{ margin: 0 }}>{a.code}</div>
          <span
            className="pill"
            style={{ marginTop: 8, display: 'inline-flex', background: 'color-mix(in srgb, ' + meta.color + ' 14%, transparent)', color: meta.color }}
          >
            <i className={'ti ' + meta.icon} style={{ fontSize: 13, marginRight: 4 }} />
            {meta.label}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="detail-meta"><i className="ti ti-category" />{a.category}</div>
        <div className="detail-meta"><i className="ti ti-map-pin" />{a.location}</div>
        {a.serial && <div className="detail-meta"><i className="ti ti-barcode" />{a.serial}</div>}
        {a.installedAt && <div className="detail-meta"><i className="ti ti-calendar" />Installed {fmtDateLong(new Date(a.installedAt))}</div>}
      </div>

      {a.pmIntervalDays && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Preventive maintenance</span>
            <span className="act">every {a.pmIntervalDays}d</span>
          </div>
          <div className="ins-card" style={{ padding: '13px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 8 }}>{a.pmTask}</div>
            <div className="detail-meta" style={{ marginTop: 0 }}>
              <i className="ti ti-rotate-clockwise" />
              Last serviced {a.lastServiceAt ? fmtDateLong(new Date(a.lastServiceAt)) : '—'}
            </div>
            {due && (
              <div className="detail-meta" style={{ color: meta.color }}>
                <i className={'ti ' + meta.icon} />
                {st === 'overdue'
                  ? `Overdue by ${Math.abs(left ?? 0)} day${Math.abs(left ?? 0) === 1 ? '' : 's'} (was due ${fmtDateLong(due)})`
                  : `Next due ${fmtDateLong(due)}${left !== null ? ` · in ${left} day${left === 1 ? '' : 's'}` : ''}`}
              </div>
            )}
          </div>

          {canService ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="fab" style={{ flex: 1, justifyContent: 'center' }} onClick={() => logService(a.id, user.name)}>
                <i className="ti ti-check" /> Log service done
              </button>
              <button className="btn-soft" style={{ flex: 1, justifyContent: 'center' }} onClick={createWorkOrder}>
                <i className="ti ti-clipboard-plus" /> Create work order
              </button>
            </div>
          ) : (
            <div className="page-sub" style={{ fontSize: 13, marginTop: 12 }}>
              Maintenance staff can log service or open a work order from here.
            </div>
          )}
        </>
      )}

      {(a.serviceLog?.length ?? 0) > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            <span className="lbl">Service history</span>
            <span className="act">{a.serviceLog!.length}</span>
          </div>
          <div className="list">
            {a.serviceLog!.map((s, i) => (
              <div key={s.at + i}>
                {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                <div className="row" style={{ cursor: 'default' }}>
                  <span className="dot" style={{ background: 'var(--ok)' }} />
                  <span className="body">
                    <span className="title">Serviced by {s.by}</span>
                    <span className="sub">{fmtDateLong(new Date(s.at))}{s.note ? ` · ${s.note}` : ''}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 20 }} />
    </>
  );
}
