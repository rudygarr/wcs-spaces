import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database, Room, Resource, PersonRec, EventRec, WorkItem, Driver, Template, Notif, ConflictNote, Asset, Rental } from './types';
import { buildSeed, SEED_VERSION } from './seed';
import { loadDB, saveDB, clearDB } from './persistence';
import { DEMO_TODAY } from './data';
import { channelsFor } from './notify';

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
  checkInEvent: (id: string) => void;
  releaseEvent: (id: string) => void;
  restoreEvent: (id: string) => void;
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
  addAsset: (a: Omit<Asset, 'id'>) => Asset;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  logService: (id: string, by: string, note?: string) => void;
  addRental: (r: Omit<Rental, 'id' | 'createdAt'>) => Rental;
  updateRental: (id: string, patch: Partial<Rental>) => void;
  confirmRental: (id: string) => void;
  cancelRental: (id: string) => void;
  reset: () => void;
}

// A confirmed rental shows up on the master calendar as a real (external)
// booking, so it conflict-checks and draws down rooms like anything else.
function rentalEvent(r: Rental, id: string): EventRec {
  const starts = r.startTime ? `${r.date}T${r.startTime}:00-04:00` : `${r.date}T00:00:00-04:00`;
  const ends = r.endTime ? `${r.date}T${r.endTime}:00-04:00` : starts;
  return {
    name: `${r.purpose} (${r.org})`,
    starts_at: starts,
    ends_at: ends,
    all_day: !r.startTime,
    setup_starts: null,
    teardown_ends: null,
    recurrence: null,
    location: r.room,
    owner: r.org,
    status: 'Approved',
    percent_approved: 100,
    details: `External rental — ${r.org}. Contact: ${r.contact}.`,
    rooms: [r.room],
    resources: [],
    source: 'internal',
    category: 'Rental',
    kind: 'booking',
    expectedAttendance: r.attendance,
    id,
  };
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
    // Confirm the space is in use. Stamps DEMO_TODAY (demo-frame rule) and clears
    // any prior release.
    checkInEvent(id) {
      const now = DEMO_TODAY.toISOString();
      commit((d) => ({
        ...d,
        events: d.events.map((e) => (e.id === id ? { ...e, checkInAt: now, released: false } : e)),
      }));
    },
    // Reclaim a no-show's slot (frees room + stock). Reversible via restoreEvent.
    releaseEvent(id) {
      commit((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, released: true } : e)) }));
    },
    restoreEvent(id) {
      commit((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, released: false } : e)) }));
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
      commit((d) => {
        // Deliver on the recipient's chosen channels (in-app always, + email/Teams).
        const person = d.people.find((p) => p.name === n.to);
        const notif: Notif = {
          ...n,
          id: uid('n'),
          createdAt: new Date().toISOString(),
          channels: n.channels ?? channelsFor(person),
        };
        return { ...d, notifications: [...d.notifications, notif] };
      });
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
    addAsset(a) {
      const asset: Asset = { ...a, id: uid('as') };
      commit((d) => ({ ...d, assets: [...(d.assets ?? []), asset] }));
      return asset;
    },
    updateAsset(id, patch) {
      commit((d) => ({ ...d, assets: (d.assets ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    },
    logService(id, by, note) {
      // Stamp at the demo's "today" so logging service clears the PM in-frame.
      const now = DEMO_TODAY.toISOString();
      commit((d) => ({
        ...d,
        assets: (d.assets ?? []).map((a) =>
          a.id === id
            ? { ...a, lastServiceAt: now, serviceLog: [{ at: now, by, note }, ...(a.serviceLog ?? [])] }
            : a,
        ),
      }));
    },
    addRental(r) {
      const rental: Rental = { ...r, id: uid('rent'), createdAt: DEMO_TODAY.toISOString() };
      commit((d) => ({ ...d, rentals: [...(d.rentals ?? []), rental] }));
      return rental;
    },
    updateRental(id, patch) {
      commit((d) => ({ ...d, rentals: (d.rentals ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    },
    // Confirm a rental: put it on the calendar (create the linked event if needed,
    // or un-release a previously cancelled one) and mark it Confirmed.
    confirmRental(id) {
      commit((d) => {
        const r = (d.rentals ?? []).find((x) => x.id === id);
        if (!r) return d;
        let events = d.events;
        let eventId = r.eventId;
        if (eventId && events.some((e) => e.id === eventId)) {
          events = events.map((e) => (e.id === eventId ? { ...e, released: false } : e));
        } else {
          eventId = uid('rent-evt');
          events = [...events, rentalEvent(r, eventId)];
        }
        return {
          ...d,
          events,
          rentals: (d.rentals ?? []).map((x) => (x.id === id ? { ...x, status: 'Confirmed', eventId } : x)),
        };
      });
    },
    // Cancel: free the room by releasing the linked event (reversible — confirming
    // again restores it), and mark the rental Cancelled.
    cancelRental(id) {
      commit((d) => {
        const r = (d.rentals ?? []).find((x) => x.id === id);
        const events = r?.eventId
          ? d.events.map((e) => (e.id === r.eventId ? { ...e, released: true } : e))
          : d.events;
        return {
          ...d,
          events,
          rentals: (d.rentals ?? []).map((x) => (x.id === id ? { ...x, status: 'Cancelled' } : x)),
        };
      });
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
