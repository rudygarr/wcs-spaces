import type { PersonRec } from './types';

// Three privilege levels, derived from the existing permission fields.
// 2 = site admin, 1 = people-editor (can manage users), 0 = viewer.
export type Level = 0 | 1 | 2;

export function levelOf(p: Pick<PersonRec, 'site_admin' | 'people'>): Level {
  if (p.site_admin) return 2;
  if (p.people === 'Editor') return 1;
  return 0;
}

export function canManagePeople(actor: PersonRec): boolean {
  return levelOf(actor) >= 1;
}

export interface Permit {
  ok: boolean;
  reason?: string;
}

// Can `actor` edit `target`'s access at all? The core RBAC rules:
//  - you need people-management rights
//  - you can't edit your own access (no self-promotion / lockout)
//  - you can't edit a peer or someone above you
export function canEditPerson(actor: PersonRec, target: PersonRec): Permit {
  if (levelOf(actor) < 1) return { ok: false, reason: "You don't have people-management rights." };
  if (actor.id === target.id) return { ok: false, reason: "You can't change your own access." };
  if (levelOf(target) >= levelOf(actor))
    return { ok: false, reason: `Only a higher-level admin can change ${target.name}'s access.` };
  return { ok: true };
}

// Granting admin is reserved for admins; revoking can't remove the last one.
export function canToggleAdmin(actor: PersonRec, target: PersonRec, all: PersonRec[]): Permit {
  const base = canEditPerson(actor, target);
  if (!base.ok) return base;
  if (levelOf(actor) < 2) return { ok: false, reason: 'Only an administrator can grant or revoke admin.' };
  if (target.site_admin) {
    const admins = all.filter((p) => p.site_admin && p.active !== false).length;
    if (admins <= 1) return { ok: false, reason: "Can't remove the last administrator." };
  }
  return { ok: true };
}

export function canDeactivate(actor: PersonRec, target: PersonRec, all: PersonRec[]): Permit {
  const base = canEditPerson(actor, target);
  if (!base.ok) return base;
  if (target.site_admin) {
    const admins = all.filter((p) => p.site_admin && p.active !== false).length;
    if (admins <= 1) return { ok: false, reason: "Can't deactivate the last administrator." };
  }
  return { ok: true };
}
