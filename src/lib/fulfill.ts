import type { Department, PersonRec, WorkItem } from './types';

// Who can delegate work in a department: a site admin, or that department's Lead.
// (Production enforces this server-side; here it gates the UI the same way.)
export function canDelegate(user: PersonRec, dept: Department): boolean {
  return !!user.site_admin || (user.department === dept && user.deptRole === 'Lead');
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
