import type { Database, PersonRec } from './types';

// Global search across everything a user works with — bookings, work orders,
// rentals, assets, people and spaces. Competitors get dinged hard for weak or
// missing search (Incident IQ: "can't keyword search tickets"; FMX: "search
// requests by the person who put them in"), so this is a first-class feature.

export type SearchKind = 'booking' | 'work' | 'rental' | 'asset' | 'person' | 'room';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  sub?: string;
  link: string;
  icon: string;
  color: string;
  score: number;
}

export const SEARCH_KIND_META: Record<SearchKind, { label: string; icon: string; color: string }> = {
  booking: { label: 'Bookings', icon: 'ti-calendar', color: 'var(--info)' },
  work: { label: 'Work orders', icon: 'ti-tool', color: 'var(--warn)' },
  rental: { label: 'Rentals', icon: 'ti-building-community', color: 'var(--green)' },
  asset: { label: 'Assets', icon: 'ti-box', color: 'var(--text-2)' },
  person: { label: 'People', icon: 'ti-user', color: 'var(--gold)' },
  room: { label: 'Spaces', icon: 'ti-door', color: 'var(--green)' },
};

// Score a record against the query: a hit in the primary field (the title)
// outranks a hit anywhere else, and a prefix/word-start beats a mid-word hit.
function score(q: string, title: string, rest: string[]): number {
  const t = title.toLowerCase();
  const i = t.indexOf(q);
  if (i === 0) return 100;
  if (i > 0) return t[i - 1] === ' ' ? 80 : 60;
  return rest.some((r) => r.toLowerCase().includes(q)) ? 30 : 0;
}

export function search(db: Database, rawQuery: string, viewer?: PersonRec): SearchResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: SearchResult[] = [];
  const push = (s: number, r: Omit<SearchResult, 'score'>) => {
    if (s > 0) out.push({ ...r, score: s });
  };

  for (const e of db.events) {
    if (e.released) continue;
    const title = e.name;
    const rest = [e.owner ?? '', e.opponent ?? '', e.team ?? '', e.category ?? '', e.details ?? '', ...(e.rooms ?? [])];
    push(score(q, title, rest), {
      kind: 'booking',
      id: e.id,
      title,
      sub: [e.rooms?.[0], e.owner].filter(Boolean).join(' · ') || undefined,
      link: `#/event/${e.id}`,
      icon: SEARCH_KIND_META.booking.icon,
      color: SEARCH_KIND_META.booking.color,
    });
  }

  for (const w of db.workItems) {
    const rest = [w.details ?? '', w.location ?? '', w.requestedBy, w.assignee ?? '', w.type, w.department];
    push(score(q, w.title, rest), {
      kind: 'work',
      id: w.id,
      title: w.title,
      sub: [w.department, w.status, w.location].filter(Boolean).join(' · ') || undefined,
      link: `#/work/${w.id}`,
      icon: SEARCH_KIND_META.work.icon,
      color: SEARCH_KIND_META.work.color,
    });
  }

  // Rental records are admin-only data — only an admin can find them.
  if (viewer?.site_admin) {
    for (const r of db.rentals ?? []) {
      const rest = [r.contact, r.purpose, r.room, r.email ?? '', r.status];
      push(score(q, r.org, rest), {
        kind: 'rental',
        id: r.id,
        title: r.org,
        sub: [r.room, r.status].filter(Boolean).join(' · ') || undefined,
        link: `#/rental/${r.id}`,
        icon: SEARCH_KIND_META.rental.icon,
        color: SEARCH_KIND_META.rental.color,
      });
    }
  }

  for (const a of db.assets ?? []) {
    const rest = [a.code, a.location, a.serial ?? '', a.category];
    push(score(q, a.name, rest), {
      kind: 'asset',
      id: a.id,
      title: a.name,
      sub: [a.code, a.location].filter(Boolean).join(' · ') || undefined,
      link: `#/asset/${a.id}`,
      icon: SEARCH_KIND_META.asset.icon,
      color: SEARCH_KIND_META.asset.color,
    });
  }

  for (const p of db.people) {
    if (p.active === false) continue;
    push(score(q, p.name, [p.email ?? '', p.department ?? '']), {
      kind: 'person',
      id: p.id,
      title: p.name,
      sub: [p.department, p.deptRole].filter(Boolean).join(' · ') || (p.site_admin ? 'Administrator' : undefined),
      link: `#/person/${p.id}`,
      icon: SEARCH_KIND_META.person.icon,
      color: SEARCH_KIND_META.person.color,
    });
  }

  for (const room of db.rooms) {
    push(score(q, room.name, [room.folder]), {
      kind: 'room',
      id: room.id,
      title: room.name,
      sub: room.folder,
      link: `#/room/${room.id}`,
      icon: SEARCH_KIND_META.room.icon,
      color: SEARCH_KIND_META.room.color,
    });
  }

  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
