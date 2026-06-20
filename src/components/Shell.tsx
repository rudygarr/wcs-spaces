import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useSession, initials, roleLabel } from '../lib/session';
import { levelOf } from '../lib/access';
import AddStaff from './AddStaff';
import type { ReactNode } from 'react';

function RoleSwitcher() {
  const { user, setUser } = useSession();
  const { db, reset } = useStore();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const sorted = [...db.people]
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.site_admin === b.site_admin ? a.name.localeCompare(b.name) : a.site_admin ? -1 : 1));
  return (
    <>
      <button className="userchip" onClick={() => setOpen(true)} aria-label="Switch user">
        <span>{user.name}</span>
        <span className="avatar">{initials(user.name)}</span>
      </button>
      {open && (
        <div className="switch-backdrop" onClick={() => setOpen(false)}>
          <div className="switch-panel" onClick={(e) => e.stopPropagation()}>
            <div className="switch-head">View the app as any staff member — fakes sign-in for the demo.</div>
            <button
              className="add-row"
              onClick={() => {
                setOpen(false);
                setAdding(true);
              }}
            >
              <i className="ti ti-user-plus" /> Add staff member
            </button>
            <div className="divider" />
            {sorted.map((p) => (
              <button
                key={p.id}
                className={'switch-row' + (p.id === user.id ? ' active' : '')}
                onClick={() => {
                  setUser(p);
                  setOpen(false);
                }}
              >
                <span className="avatar">{initials(p.name)}</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, letterSpacing: '-0.01em' }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {roleLabel(p)}
                    {p.resolves_conflicts ? ' · Conflict resolver' : ''}
                  </div>
                </span>
                {p.id === user.id && <i className="ti ti-check" style={{ color: 'var(--green)' }} />}
              </button>
            ))}
            <div className="divider" />
            <button
              className="add-row"
              style={{ color: 'var(--text-3)' }}
              onClick={() => {
                if (confirm('Reset all demo data back to the original seed? Any rooms, staff, or bookings you added will be removed.')) {
                  reset();
                  setOpen(false);
                }
              }}
            >
              <i className="ti ti-refresh" /> Reset demo data
            </button>
          </div>
        </div>
      )}
      {adding && (
        <AddStaff canMakeAdmin={levelOf(user) === 2} onAdded={setUser} onClose={() => setAdding(false)} />
      )}
    </>
  );
}

const tabs = [
  { to: '/', icon: 'ti-home', label: 'Home' },
  { to: '/calendar', icon: 'ti-calendar', label: 'Calendar' },
  { to: '/spaces', icon: 'ti-building', label: 'Spaces' },
  { to: '/people', icon: 'ti-users', label: 'People' },
  { to: '/requests', icon: 'ti-inbox', label: 'Requests' },
];

export default function Shell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => nav('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
            <span className="brand-mark">
              <i className="ti ti-building-arch" />
            </span>
            <span className="brand-name">Spaces</span>
          </button>
          <RoleSwitcher />
        </div>
      </div>

      <div className="container" style={{ paddingTop: 22 }}>
        {children}
      </div>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {tabs.map((t) => {
            const active = t.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(t.to);
            return (
              <button key={t.to} className={'tab' + (active ? ' active' : '')} onClick={() => nav(t.to)}>
                <i className={'ti ' + t.icon} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
