import type { Database, EventRec, PersonRec } from './types';

// Booking approval routing. Mirrors Planning Center's "approval groups": each
// space area has an owner who must sign off before a booking is confirmed. We
// key approvers by room *folder* (the natural grouping), with a fallback to the
// central scheduling office. Demo guesses — correct once real owners weigh in.
const FOLDER_APPROVER: Record<string, string> = {
  'Lighthouse PAC': 'Rudy Garrido',
  'The Beacon': 'Rudy Garrido',
  'Fine Arts': 'Rudy Garrido',
  Athletics: 'Adriana Marrero',
  'Elementary School': 'Lori Sakkab',
  'Middle School': 'Julie Doan',
  'High School': 'Angie Spivak-Lopez',
  'Nature Center': 'Madeline Dirube',
  'Wild Acre': 'Madeline Dirube',
  'Media Center': 'Sherry Medder',
  Administration: 'Sherry Medder',
};
const DEFAULT_APPROVER = 'Sherry Medder';

export function folderApprover(folder: string): string {
  return FOLDER_APPROVER[folder] ?? DEFAULT_APPROVER;
}

// The folder a room belongs to (rooms carry no folder reference on the event).
function folderOfRoom(db: Database, roomName: string): string | null {
  return db.rooms.find((r) => r.name === roomName)?.folder ?? null;
}

export interface ApprovalStep {
  approver: string;
  area: string; // folder
  status: 'Approved' | 'Declined' | 'Pending';
  at?: string;
}

// Who must sign off on this event, one step per distinct approver, with each
// approver's current decision. Empty if the event books no rooms.
export function approvalSteps(db: Database, e: EventRec): ApprovalStep[] {
  const byApprover = new Map<string, ApprovalStep>();
  for (const room of e.rooms) {
    const folder = folderOfRoom(db, room);
    if (!folder) continue;
    const approver = folderApprover(folder);
    if (byApprover.has(approver)) continue;
    const decided = e.approvals?.find((a) => a.approver === approver);
    byApprover.set(approver, {
      approver,
      area: folder,
      status: decided?.status ?? 'Pending',
      at: decided?.at,
    });
  }
  return [...byApprover.values()];
}

// Overall status derived from the steps: any decline → Declined; all approved →
// Approved; otherwise Pending. Falls back to the event's own status when there
// are no room approvers (e.g. notices).
export function derivedStatus(steps: ApprovalStep[], fallback: EventRec['status']): EventRec['status'] {
  if (steps.length === 0) return fallback;
  if (steps.some((s) => s.status === 'Declined')) return 'Declined';
  if (steps.every((s) => s.status === 'Approved')) return 'Approved';
  return 'Pending';
}

// Can this user act on the approval (their own step, or an admin override)?
export function canApprove(user: PersonRec, steps: ApprovalStep[]): boolean {
  if (user.site_admin || user.resolves_conflicts) return true;
  return steps.some((s) => s.approver === user.name);
}

// A real booking request that can sit in an approval queue (excludes calendar
// notices and the parenthetical annotation events like "(Music bleed…)").
export function isApprovable(e: EventRec): boolean {
  return e.kind !== 'notice' && e.status === 'Pending' && !e.withdrawn && !e.cancelled && !e.name.trim().startsWith('(');
}

// Events still waiting on THIS person's sign-off.
export function pendingForApprover(db: Database, name: string): EventRec[] {
  return db.events.filter(
    (e) => isApprovable(e) && approvalSteps(db, e).some((s) => s.approver === name && s.status === 'Pending'),
  );
}
