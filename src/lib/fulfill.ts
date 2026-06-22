import type { Department, PersonRec, WorkItem } from './types';

// Who can delegate work in a department: a site admin, or that department's Lead.
// (Production enforces this server-side; here it gates the UI the same way.)
export function canDelegate(user: PersonRec, dept: Department): boolean {
  return !!user.site_admin || (user.department === dept && user.deptRole === 'Lead');
}

// IT runs as a flat, collaborative pool (confirmed with WCS IT): every tech sees
// every ticket and can self-assign, hand it to a teammate, move it along, and
// close anyone's — no ownership wall, no approval gate. So on the IT queue, the
// whole department (plus site admins) gets the same powers a Lead has elsewhere.
// Maintenance/Transportation stay Lead-gated via canDelegate. Production must
// enforce this server-side; here it gates the UI identically.
export function inPool(user: PersonRec, dept: Department): boolean {
  if (dept !== 'IT') return false;
  return !!user.site_admin || user.department === 'IT';
}

// Can this user assign/route/close work here? True for delegators (Lead/admin)
// and for any member of a flat pool (IT).
export function canWorkPool(user: PersonRec, dept: Department): boolean {
  return canDelegate(user, dept) || inPool(user, dept);
}

// The crew a lead can hand work to — that department's people, Leads first.
export function deptTeam(people: PersonRec[], dept: Department): PersonRec[] {
  return people
    .filter((p) => p.active !== false && p.department === dept)
    .sort((a, b) => {
      if (a.deptRole !== b.deptRole) return a.deptRole === 'Lead' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

// Is this work item on my plate? Either I'm the assignee, or (for trips) I'm
// driving one of its legs.
export function assignedToMe(w: WorkItem, user: PersonRec): boolean {
  if (w.assignee === user.name) return true;
  return !!w.trip?.legs.some((l) => l.driver === user.name);
}

// "Maintenance · Lead" — shown next to a name in the role switcher / detail.
export function deptRoleText(p: PersonRec): string | null {
  if (!p.department) return null;
  return `${p.department} · ${p.deptRole ?? 'Team'}`;
}
