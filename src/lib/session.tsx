import { createContext, useContext, useState, type ReactNode } from 'react';
import { buildSeed } from './seed';
import { setAuditActor } from './store';
import type { PersonRec } from './types';

// Fakes auth for the demo: pick any staff member and the whole app
// re-renders as if they were signed in. Replaced by Microsoft SSO later.
interface SessionCtx {
  user: PersonRec;
  setUser: (p: PersonRec) => void;
  // Demo sign-in gate: the splash sets this true. Real Microsoft SSO later.
  authed: boolean;
  signIn: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

const seedPeople = buildSeed().people;
const defaultUser = seedPeople.find((p) => p.name === 'Rudy Garrido') ?? seedPeople[0];

// Keep the audit trail's actor in lock-step with the "view as" user, so store
// mutations attribute changes to whoever's currently signed in.
setAuditActor(defaultUser.name);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PersonRec>(defaultUser);
  const [authed, setAuthed] = useState(false);
  const switchUser = (p: PersonRec) => {
    setAuditActor(p.name);
    setUser(p);
  };
  return (
    <Ctx.Provider value={{ user, setUser: switchUser, authed, signIn: () => setAuthed(true) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession outside provider');
  return c;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function roleLabel(p: { site_admin: boolean; rooms: string; resources: string; event: string; department?: string; deptRole?: string }): string {
  // A department role is the most relevant hat when they have one.
  if (p.department) return `${p.department} · ${p.deptRole ?? 'Team'}`;
  if (p.site_admin) return 'Administrator';
  if (p.rooms === 'Editor' || p.resources === 'Editor') return 'Editor';
  if (p.event?.includes('Creator')) return 'Event creator';
  return 'Viewer';
}
