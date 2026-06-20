import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database, Room, Resource, PersonRec, EventRec, WorkItem, Driver, Template } from './types';
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
  updateEvent: (id: string, patch: Partial<EventRec>) => void;
  reassignOwner: (fromName: string, toName: string) => void;
  addWorkItem: (w: Omit<WorkItem, 'id'>) => WorkItem;
  updateWorkItem: (id: string, patch: Partial<WorkItem>) => void;
  addDriver: (d: Omit<Driver, 'id'>) => Driver;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  addTemplate: (t: Omit<Template, 'id'>) => Template;
  removeTemplate: (id: string) => void;
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

  function commit(next: Database) {
    setDb(next);
    void saveDB(next);
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
      commit({ ...db, rooms: [...db.rooms, room] });
      return room;
    },
    addResource(name, folder) {
      const resource: Resource = { id: uid('res'), name: name.trim(), folder };
      commit({ ...db, resources: [...db.resources, resource] });
      return resource;
    },
    addPerson(p) {
      const person: PersonRec = { ...p, id: uid('p') };
      commit({ ...db, people: [...db.people, person] });
      return person;
    },
    updatePerson(id, patch) {
      commit({ ...db, people: db.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    },
    addEvent(e) {
      const ev: EventRec = { ...e, id: uid('e') };
      commit({ ...db, events: [...db.events, ev] });
      return ev;
    },
    updateEvent(id, patch) {
      commit({ ...db, events: db.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
    },
    reassignOwner(fromName, toName) {
      commit({
        ...db,
        events: db.events.map((e) => (e.owner === fromName ? { ...e, owner: toName } : e)),
      });
    },
    addWorkItem(w) {
      const item: WorkItem = { ...w, id: uid('w') };
      commit({ ...db, workItems: [...db.workItems, item] });
      return item;
    },
    updateWorkItem(id, patch) {
      commit({ ...db, workItems: db.workItems.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
    },
    addDriver(d) {
      const driver: Driver = { ...d, id: uid('drv'), active: true };
      commit({ ...db, drivers: [...db.drivers, driver] });
      return driver;
    },
    updateDriver(id, patch) {
      commit({ ...db, drivers: db.drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
    },
    addTemplate(t) {
      const tpl: Template = { ...t, id: uid('tpl') };
      commit({ ...db, templates: [...db.templates, tpl] });
      return tpl;
    },
    removeTemplate(id) {
      commit({ ...db, templates: db.templates.filter((t) => t.id !== id) });
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
