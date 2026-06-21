import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { fmtDateLong } from '../lib/data';
import { STATUS_META, COI_LABEL, PAY_LABEL, money, outstanding, readyToConfirm } from '../lib/rentals';
import AuditHistory from '../components/AuditHistory';
import type { CoiStatus, PayStatus } from '../lib/types';

// A compact status row with record-only action buttons. No amounts are charged —
// the office records what its real billing system already did (payment entry
// stays prohibited in the demo).
function GateRow({ icon, label, value, color, actions }: { icon: string; label: string; value: string; color?: string; actions: { t: string; on: () => void; soft?: boolean }[] }) {
  return (
    <div className="gate-row">
      <div className="gate-head">
        <span className="gate-label"><i className={'ti ' + icon} /> {label}</span>
        <span className="gate-val" style={color ? { color } : undefined}>{value}</span>
      </div>
      <div className="gate-actions">
        {actions.map((a) => (
          <button key={a.t} className={a.soft ? 'gate-btn soft' : 'gate-btn'} onClick={a.on}>{a.t}</button>
        ))}
      </div>
    </div>
  );
}

export default function RentalDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, updateRental, confirmRental, cancelRental } = useStore();
  const { user } = useSession();
  const r = (db.rentals ?? []).find((x) => x.id === id);

  if (!r) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="page-sub">Rental not found.</div>
        <button className="btn-soft" style={{ marginTop: 16 }} onClick={() => nav('/rentals')}>Back to Rentals</button>
      </div>
    );
  }

  const canManage = user.site_admin;
  const meta = STATUS_META[r.status];
  const out = outstanding(r);
  const setCoi = (coi: CoiStatus) => updateRental(r.id, { coi });
  const setDeposit = (depositStatus: PayStatus) => updateRental(r.id, { depositStatus });
  const setInvoice = (invoiceStatus: PayStatus) => updateRental(r.id, { invoiceStatus });
  const when = r.startTime ? `${fmtDateLong(new Date(r.date + 'T12:00:00'))} · ${r.startTime}–${r.endTime ?? ''}` : fmtDateLong(new Date(r.date + 'T12:00:00'));

  return (
    <>
      <button className="back-link" onClick={() => nav(-1)}>
        <i className="ti ti-chevron-left" /> Back
      </button>

      <div style={{ display: 'flex', gap: 13, alignItems: 'center', marginTop: 6 }}>
        <span className="tile-icon" style={{ width: 46, height: 46, borderRadius: 14, fontSize: 22, background: meta.tint, color: meta.color, flexShrink: 0 }}>
          <i className={'ti ' + meta.icon} />
        </span>
        <div>
          <h1 className="page-h" style={{ marginBottom: 4, fontSize: 23 }}>{r.org}</h1>
          <span className="pill" style={{ background: meta.tint, color: meta.color }}>{r.status}</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="detail-meta"><i className="ti ti-calendar-event" />{r.purpose}</div>
        <div className="detail-meta"><i className="ti ti-map-pin" />{r.room}</div>
        <div className="detail-meta"><i className="ti ti-clock" />{when}</div>
        {r.attendance ? <div className="detail-meta"><i className="ti ti-users" />{r.attendance} expected</div> : null}
        {r.eventId && db.events.some((e) => e.id === r.eventId) && (
          <button className="detail-meta" style={{ color: 'var(--info)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => nav('/event/' + r.eventId)}>
            <i className="ti ti-calendar" />On the master calendar →
          </button>
        )}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Contact</span>
      </div>
      <div className="ins-card" style={{ padding: '13px 14px' }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.contact || '—'}</div>
        {r.email && <div className="detail-meta" style={{ marginTop: 6 }}><i className="ti ti-mail" />{r.email}</div>}
        {r.phone && <div className="detail-meta"><i className="ti ti-phone" />{r.phone}</div>}
      </div>

      <div className="section-label" style={{ marginTop: 22 }}>
        <span className="lbl">Insurance, deposit &amp; invoice</span>
        <span className="act">{money(r.fee)} fee</span>
      </div>

      {canManage ? (
        <div className="gate-list">
          <GateRow
            icon="ti-file-shield"
            label="Certificate of insurance"
            value={COI_LABEL[r.coi]}
            color={out.coi ? 'var(--warn)' : 'var(--ok)'}
            actions={r.coi === 'received' ? [{ t: 'Mark missing', on: () => setCoi('pending'), soft: true }] : [{ t: 'Mark on file', on: () => setCoi('received') }, { t: 'Waive', on: () => setCoi('waived'), soft: true }]}
          />
          <GateRow
            icon="ti-cash"
            label={`Deposit (${money(r.deposit)})`}
            value={PAY_LABEL[r.depositStatus]}
            color={out.deposit ? 'var(--warn)' : 'var(--ok)'}
            actions={r.depositStatus === 'paid' ? [{ t: 'Mark unpaid', on: () => setDeposit('unpaid'), soft: true }] : [{ t: 'Mark received', on: () => setDeposit('paid') }, { t: 'Waive', on: () => setDeposit('waived'), soft: true }]}
          />
          <GateRow
            icon="ti-receipt"
            label="Invoice"
            value={PAY_LABEL[r.invoiceStatus]}
            color={out.invoice ? 'var(--warn)' : 'var(--ok)'}
            actions={
              r.invoiceStatus === 'paid'
                ? [{ t: 'Mark unpaid', on: () => setInvoice('unpaid'), soft: true }]
                : r.invoiceStatus === 'invoiced'
                ? [{ t: 'Mark paid', on: () => setInvoice('paid') }]
                : [{ t: 'Mark invoiced', on: () => setInvoice('invoiced') }, { t: 'Mark paid', on: () => setInvoice('paid'), soft: true }]
            }
          />
          <div className="gate-note"><i className="ti ti-lock" /> Records only — no card numbers or charges in the app. Reconcile against the school's billing system.</div>
        </div>
      ) : (
        <div className="page-sub" style={{ fontSize: 13 }}>Administrators record COI, deposit and invoice status here.</div>
      )}

      {r.notes && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}><span className="lbl">Notes</span></div>
          <div className="ins-card" style={{ padding: '13px 14px', fontSize: 14, color: 'var(--text-2)' }}>{r.notes}</div>
        </>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          {r.status !== 'Confirmed' && r.status !== 'Completed' && (
            <button className="fab" style={{ flex: 1, justifyContent: 'center', minWidth: 150 }} onClick={() => confirmRental(r.id)}>
              <i className="ti ti-circle-check" /> Confirm booking
            </button>
          )}
          {r.status === 'Confirmed' && (
            <button className="fab" style={{ flex: 1, justifyContent: 'center', minWidth: 150 }} onClick={() => updateRental(r.id, { status: 'Completed' })}>
              <i className="ti ti-flag-check" /> Mark completed
            </button>
          )}
          {r.status === 'Cancelled' ? (
            <button className="btn-soft" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }} onClick={() => updateRental(r.id, { status: 'Inquiry' })}>
              <i className="ti ti-rotate" /> Reopen
            </button>
          ) : (
            <button className="btn-soft" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }} onClick={() => cancelRental(r.id)}>
              <i className="ti ti-ban" /> Cancel
            </button>
          )}
        </div>
      )}
      {canManage && r.status !== 'Confirmed' && r.status !== 'Completed' && !readyToConfirm(r) && (
        <div className="gate-note" style={{ marginTop: 10, color: 'var(--warn)' }}>
          <i className="ti ti-alert-triangle" /> No certificate of insurance on file yet — you can still confirm, but most rentals shouldn't go on the calendar without it.
        </div>
      )}
      <AuditHistory entityId={r.id} />
      <div style={{ height: 20 }} />
    </>
  );
}
