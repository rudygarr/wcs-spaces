import { createContext, useContext, useState, type ReactNode } from 'react';
import { people } from './data';
import type { Person } from './types';

// Fakes auth for the demo: pick any real staff member and the whole app
// re-renders as if they were signed in. Replaced by Microsoft SSO later.
interface SessionCtx {
  user: Person;
  setUser: (p: Person) => void;
}

const Ctx = createContext<SessionCtx | null>(null);

const defaultUser = people.find((p) => p.name === 'Rudy Garrido') ?? people[0];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Person>(defaultUser);
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
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

export function roleLabel(p: Person): string {
  if (p.site_admin) return 'Administrator';
  if (p.rooms === 'Editor' || p.resources === 'Editor') return 'Editor';
  if (p.event?.includes('Creator')) return 'Event creator';
  return 'Viewer';
}
