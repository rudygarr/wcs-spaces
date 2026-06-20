import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database, Room, Resource, PersonRec, EventRec, WorkItem, Driver, Template, Notif, ConflictNote } from './types';
import { buildSeed, SEED_VERSION } from './seed';
import { loadDB, saveDB, clearDB } from './persistence';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface StoreCtx {
  db: Database;
  addRoom: (name: string, folder: string) => Room;
  addResource: (name: string, folder: string) => Resource;
  addPerson: (p: Omit<PersonRec, 'id'>) => PersonRec;
  updatePerson: (id: string, patch: Partial<PersonRec>) => void;
  addEvent: (e: Omit<EventRec, 'id'>) => EventRec;
  addEvents: (list: Omit<EventRec, 'id'>[]) => EventRec[];
  updateEvent: (id: string, patch: Partial<EventRec>) => void;
  reassignOwner: (fromName: string, toName: string) => void;
  addWorkItem: (w: Omit<WorkItem, 'id'>) => WorkItem;
  updateWorkItem: (id: string, patch: Partial<WorkItem>) => void;
  addDriver: (d: Omit<Driver, 'id'>) => Driver;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  addTemplate: (t: Omit<Template, 'id'>) => Template;
  removeTemplate: (id: string) => void;
  notify: (n: Omit<Notif, 'id' | 'createdAt' | 'read'>) => void;
  markNotifsReadFor: (name: string) => void;
  addConflictNote: (n: Omit<ConflictNote, 'id' | 'at'>) => void;
  reset: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);

  useEffect(() => {
    loadDB().then((saved) => {
      // Discard a saved DB from an older seed so new demo data shows up.
      const fresh = !saved || saved.seedVersion !== SEED_VERSION;
      if (fresh) {
        const seed = buildSeed();
        setDb(seed);
        void saveDB(seed);
      } else {
        setDb(saved);
      }
    });
  }, []);

  // Functional commit: each mutation receives the latest state, so two
  // mutations fired in the same event handler (e.g. update an item *and* push
  // a notification) compose instead of clobbering each other.
  function commit(updater: (prev: Database) => Database) {
    setDb((prev) => {
      const next = updater(prev as Database);
      void saveDB(next);
      return next;
    });
  }

  if (!db) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--text-3)' }}>Loading…</div>
    );
  }

  const api: StoreCtx = {
    db,
    addRoom(name, folder) {
      const room: Room = { id: uid('r'), name: name.trim(), folder };
      commit((d) => ({ ...d, rooms: [...d.rooms, room] }));
      return room;
    },
    addResource(name, folder) {
      const resource: Resource = { id: uid('res'), name: name.trim(), folder };
      commit((d) => ({ ...d, resources: [...d.resources, resource] }));
      return resource;
    },
    addPerson(p) {
      const person: PersonRec = { ...p, id: uid('p') };
      commit((d) => ({ ...d, people: [...d.people, person] }));
      return person;
    },
    updatePerson(id, patch) {
      commit((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    },
    addEvent(e) {
      const ev: EventRec = { ...e, id: uid('e') };
      commit((d) => ({ ...d, events: [...d.events, ev] }));
      return ev;
    },
    addEvents(list) {
      const evs: EventRec[] = list.map((e) => ({ ...e, id: uid('e') }));
      commit((d) => ({ ...d, events: [...d.events, ...evs] }));
      return evs;
    },
    updateEvent(id, patch) {
      commit((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    },
    reassignOwner(fromName, toName) {
      commit((d) => ({
        ...d,
        events: d.events.map((e) => (e.owner === fromName ? { ...e, owner: toName } : e)),
      }));
    },
    addWorkItem(w) {
      const item: WorkItem = { ...w, id: uid('w') };
      commit((d) => ({ ...d, workItems: [...d.workItems, item] }));
      return item;
    },
    updateWorkItem(id, patch) {
      commit((d) => ({
        ...d,
        workItems: d.workItems.map((w) => {
          if (w.id !== id) return w;
          const next = { ...w, ...patch };
          // Stamp the moment a job first reaches Done, for turnaround reporting.
          if (next.status === 'Done' && !next.completedAt) next.completedAt = new Date().toISOString();
          return next;
        }),
      }));
    },
    addDriver(dr) {
      const driver: Driver = { ...dr, id: uid('drv'), active: true };
      commit((d) => ({ ...d, drivers: [...d.drivers, driver] }));
      return driver;
    },
    updateDriver(id, patch) {
      commit((d) => ({ ...d, drivers: d.drivers.map((dr) => (dr.id === id ? { ...dr, ...patch } : dr)) }));
    },
    addTemplate(t) {
      const tpl: Template = { ...t, id: uid('tpl') };
      commit((d) => ({ ...d, templates: [...d.templates, tpl] }));
      return tpl;
    },
    removeTemplate(id) {
      commit((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) }));
    },
    notify(n) {
      if (!n.to) return;
      const notif: Notif = { ...n, id: uid('n'), createdAt: new Date().toISOString() };
      commit((d) => ({ ...d, notifications: [...d.notifications, notif] }));
    },
    markNotifsReadFor(name) {
      commit((d) =>
        d.notifications.some((n) => n.to === name && !n.read)
          ? { ...d, notifications: d.notifications.map((n) => (n.to === name ? { ...n, read: true } : n)) }
          : d,
      );
    },
    addConflictNote(n) {
      const note: ConflictNote = { ...n, id: uid('cn'), at: new Date().toISOString() };
      commit((d) => ({ ...d, conflictNotes: [...(d.conflictNotes ?? []), note] }));
    },
    reset() {
      void clearDB();
      setDb(buildSeed());
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

// convenient grouping for the directory views
export function groupByFolder<T extends { folder: string }>(items: T[]): { name: string; items: T[] }[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const it of items) {
    if (!map.has(it.folder)) {
      map.set(it.folder, []);
      order.push(it.folder);
    }
    map.get(it.folder)!.push(it);
  }
  return order.map((name) => ({ name, items: map.get(name)! }));
}
