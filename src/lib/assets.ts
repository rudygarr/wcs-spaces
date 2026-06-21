import type { Asset, Database } from './types';
import { DEMO_TODAY } from './data';

export type PMStatus = 'overdue' | 'due-soon' | 'ok' | 'none';

const DAY = 24 * 3600 * 1000;
const SOON_WINDOW = 14; // days out that counts as "coming due"

// When the next preventive-maintenance service is due (lastService + interval).
export function pmDueDate(a: Asset): Date | null {
  if (!a.pmIntervalDays || !a.lastServiceAt) return null;
  return new Date(new Date(a.lastServiceAt).getTime() + a.pmIntervalDays * DAY);
}

// Days until PM is due (negative = overdue), or null when the asset has no PM.
export function pmDaysLeft(a: Asset, today: Date = DEMO_TODAY): number | null {
  const due = pmDueDate(a);
  if (!due) return null;
  return Math.round((due.getTime() - today.getTime()) / DAY);
}

export function pmStatus(a: Asset, today: Date = DEMO_TODAY): PMStatus {
  const left = pmDaysLeft(a, today);
  if (left === null) return 'none';
  if (left < 0) return 'overdue';
  if (left <= SOON_WINDOW) return 'due-soon';
  return 'ok';
}

export const PM_META: Record<PMStatus, { label: string; color: string; icon: string }> = {
  overdue: { label: 'Overdue', color: 'var(--bad)', icon: 'ti-alert-octagon' },
  'due-soon': { label: 'Due soon', color: 'var(--warn)', icon: 'ti-clock-exclamation' },
  ok: { label: 'On track', color: 'var(--ok)', icon: 'ti-circle-check' },
  none: { label: 'No schedule', color: 'var(--text-3)', icon: 'ti-minus' },
};

// Assets needing attention now (overdue first, then due-soon), most urgent first.
export function assetsNeedingPM(db: Database, today: Date = DEMO_TODAY): Asset[] {
  return (db.assets ?? [])
    .filter((a) => a.active !== false)
    .map((a) => ({ a, left: pmDaysLeft(a, today) }))
    .filter((x) => x.left !== null && x.left! <= SOON_WINDOW)
    .sort((x, y) => (x.left ?? 0) - (y.left ?? 0))
    .map((x) => x.a);
}

export function pmDueCount(db: Database, today: Date = DEMO_TODAY): { overdue: number; soon: number } {
  let overdue = 0;
  let soon = 0;
  for (const a of db.assets ?? []) {
    const s = pmStatus(a, today);
    if (s === 'overdue') overdue++;
    else if (s === 'due-soon') soon++;
  }
  return { overdue, soon };
}
