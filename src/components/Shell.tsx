import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { people } from '../lib/data';
import { useSession, initials, roleLabel } from '../lib/session';
import type { ReactNode } from 'react';

function RoleSwitcher() {
  const { user, setUser } = useSession();
  const [open, setOpen] = useState(false);
  const sorted = [...people].sort((a, b) =>
    a.site_admin === b.site_admin ? a.name.localeCompare(b.name) : a.site_admin ? -1 : 1,
  );
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
            {sorted.map((p) => (
              <button
                key={p.email}
                className={'switch-row' + (p.email === user.email ? ' active' : '')}
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
                {p.email === user.email && <i className="ti ti-check" style={{ color: 'var(--green)' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const tabs = [
  { to: '/', icon: 'ti-home', label: 'Home' },
  { to: '/calendar', icon: 'ti-calendar', label: 'Calendar' },
  { to: '/spaces', icon: 'ti-building', label: 'Spaces' },
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
