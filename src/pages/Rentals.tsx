import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { allRooms } from '../data/inventory';
import { fmtDateLong } from '../lib/data';
import { STATUS_META, money, outstanding, outstandingCount, uncollectedTotal, rentalFollowups } from '../lib/rentals';
import type { RentalStatus } from '../lib/types';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 'var(--r-sm)',
  border: '0.5px solid var(--border-2)',
  background: 'var(--surface)',
  color: 'var(--text-1)',
  padding: '0 12px',
  fontSize: 15,
  fontFamily: 'inherit',
};

// The small outstanding glyphs on a row — COI / deposit / invoice still open.
function OutstandingDots({ r }: { r: ReturnType<typeof outstanding> }) {
  const items = [
    r.coi && { icon: 'ti-file-shield', label: 'COI' },
    r.deposit && { icon: 'ti-cash', label: 'Deposit' },
    r.invoice && { icon: 'ti-receipt', label: 'Invoice' },
  ].filter(Boolean) as { icon: string; label: string }[];
  if (items.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginRight: 6 }}>
      {items.map((it) => (
        <span key={it.label} className="rent-dot" title={`${it.label} outstanding`}>
          <i className={'ti ' + it.icon} />
        </span>
      ))}
    </span>
  );
}

function NewRentalForm({ onDone }: { onDone: (id: string) => void }) {
  const { addRental } = useStore();
  const [f, setF] = useState({ org: '', contact: '', email: '', phone: '', purpose: '', room: '', date: '', startTime: '', endTime: '', attendance: '', fee: '', deposit: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ready = f.org.trim() && f.purpose.trim() && f.room && f.date;

  function save() {
    if (!ready) return;
    const r = addRental({
      org: f.org.trim(),
      contact: f.contact.trim(),
      email: f.email.trim() || undefined,
      phone: f.phone.trim() || undefined,
      purpose: f.purpose.trim(),
      room: f.room,
      date: f.date,
      startTime: f.startTime || undefined,
      endTime: f.endTime || undefined,
      attendance: f.attendance ? Number(f.attendance) : undefined,
      status: 'Inquiry',
      fee: f.fee ? Number(f.fee) : 0,
      deposit: f.deposit ? Number(f.deposit) : 0,
      coi: 'pending',
      depositStatus: 'unpaid',
      invoiceStatus: 'unpaid',
    });
    onDone(r.id);
  }

  return (
    <div className="list" style={{ padding: 16, marginBottom: 16 }}>
      <Lbl t="Organization">
        <input style={inputStyle} placeholder="e.g. Grace Community Church" value={f.org} onChange={set('org')} />
      </Lbl>
      <div style={{ display: 'flex', gap: 10 }}>
        <Lbl t="Contact"><input style={inputStyle} placeholder="Name" value={f.contact} onChange={set('contact')} /></Lbl>
        <Lbl t="Phone"><input style={inputStyle} placeholder="Optional" value={f.phone} onChange={set('phone')} /></Lbl>
      </div>
      <Lbl t="Email"><input style={inputStyle} placeholder="Optional" value={f.email} onChange={set('email')} /></Lbl>
      <Lbl t="Event / purpose"><input style={inputStyle} placeholder="e.g. Sunday worship service" value={f.purpose} onChange={set('purpose')} /></Lbl>
      <Lbl t="Space">
        <div style={{ position: 'relative' }}>
          <select style={{ ...inputStyle, appearance: 'none' }} value={f.room} onChange={set('room')}>
            <option value="">Select a space…</option>
            {allRooms.map((r) => <option key={r}>{r}</option>)}
          </select>
          <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>
      </Lbl>
      <Lbl t="Date"><input type="date" style={{ ...inputStyle, appearance: 'auto' }} value={f.date} onChange={set('date')} /></Lbl>
      <div style={{ display: 'flex', gap: 10 }}>
        <Lbl t="Start"><input type="time" style={{ ...inputStyle, appearance: 'auto' }} value={f.startTime} onChange={set('startTime')} /></Lbl>
        <Lbl t="End"><input type="time" style={{ ...inputStyle, appearance: 'auto' }} value={f.endTime} onChange={set('endTime')} /></Lbl>
        <Lbl t="Attendance"><input type="number" style={inputStyle} placeholder="#" value={f.attendance} onChange={set('attendance')} /></Lbl>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Lbl t="Rental fee ($)"><input type="number" style={inputStyle} placeholder="0" value={f.fee} onChange={set('fee')} /></Lbl>
        <Lbl t="Deposit ($)"><input type="number" style={inputStyle} placeholder="0" value={f.deposit} onChange={set('deposit')} /></Lbl>
      </div>
      <button className="fab" style={{ width: '100%', justifyContent: 'center', opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={save}>
        <i className="ti ti-plus" /> Add rental inquiry
      </button>
    </div>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, flex: 1 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{t}</div>
      {children}
    </label>
  );
}

export default function Rentals() {
  const nav = useNavigate();
  const { db } = useStore();
  const { user } = useSession();
  const [filter, setFilter] = useState<'all' | RentalStatus>('all');
  const [adding, setAdding] = useState(false);

  const canManage = user.site_admin;
  const list = db.rentals ?? [];

  const shown = useMemo(() => {
    const f = filter === 'all' ? list : list.filter((r) => r.status === filter);
    const rank: Record<RentalStatus, number> = { Tentative: 0, Confirmed: 1, Inquiry: 2, Completed: 3, Cancelled: 4 };
    return [...f].sort((a, b) => outstandingCount(b) - outstandingCount(a) || rank[a.status] - rank[b.status] || a.date.localeCompare(b.date));
  }, [list, filter]);

  if (!canManage) {
    return (
      <>
        <h1 className="page-h">Facility rentals</h1>
        <div className="empty" style={{ marginTop: 20 }}>Rental records are visible to administrators.</div>
      </>
    );
  }

  const followups = rentalFollowups(db).length;
  const uncollected = uncollectedTotal(db);
  const counts = (s: RentalStatus) => list.filter((r) => r.status === s).length;
  const chips: { id: 'all' | RentalStatus; label: string }[] = [
    { id: 'all', label: `All ${list.length}` },
    { id: 'Tentative', label: `Tentative ${counts('Tentative')}` },
    { id: 'Confirmed', label: `Confirmed ${counts('Confirmed')}` },
    { id: 'Inquiry', label: `Inquiries ${counts('Inquiry')}` },
    { id: 'Completed', label: `Completed ${counts('Completed')}` },
  ];

  return (
    <>
      <h1 className="page-h">Facility rentals</h1>
      <div className="page-sub">External community bookings — insurance, deposits &amp; invoices</div>

      <div className="rent-summary">
        <div>
          <div className="rent-sum-num">{money(uncollected)}</div>
          <div className="rent-sum-lbl">uncollected fees</div>
        </div>
        <div>
          <div className="rent-sum-num" style={{ color: followups > 0 ? 'var(--warn)' : 'var(--ok)' }}>{followups}</div>
          <div className="rent-sum-lbl">need follow-up</div>
        </div>
      </div>

      <div className="chips" style={{ marginTop: 14, marginBottom: 14 }}>
        {chips.map((c) => (
          <button key={c.id} className={'chip' + (filter === c.id ? ' on' : '')} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <button className="fab" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }} onClick={() => setAdding((v) => !v)}>
        <i className={'ti ' + (adding ? 'ti-x' : 'ti-plus')} /> {adding ? 'Cancel' : 'New rental'}
      </button>
      {adding && <NewRentalForm onDone={(id) => { setAdding(false); nav('/rental/' + id); }} />}

      <div className="list">
        {shown.length === 0 && <div className="empty">No rentals in this view.</div>}
        {shown.map((r, i) => {
          const meta = STATUS_META[r.status];
          const out = outstanding(r);
          return (
            <div key={r.id}>
              {i > 0 && <div className="divider" style={{ marginLeft: 58 }} />}
              <button className="space-row" onClick={() => nav('/rental/' + r.id)}>
                <span className="space-ico" style={{ background: meta.tint, color: meta.color }}>
                  <i className={'ti ' + meta.icon} />
                </span>
                <span className="nm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontWeight: 550 }}>{r.org}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                    {r.purpose} · {fmtDateLong(new Date(r.date + 'T12:00:00'))} · {r.room}
                  </span>
                </span>
                <OutstandingDots r={out} />
                <span className="pill" style={{ background: meta.tint, color: meta.color, marginRight: 6 }}>
                  {r.status}
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
