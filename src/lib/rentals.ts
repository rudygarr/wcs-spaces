import type { CoiStatus, Database, PayStatus, Rental, RentalStatus } from './types';
import { DEMO_TODAY } from './data';

// External facility rentals — the admin tracking layer. Everything here is read
// model + small helpers; the store owns mutations. The three gates (COI, deposit,
// invoice) are recorded, never charged (payment entry stays prohibited).

export const STATUS_META: Record<RentalStatus, { color: string; tint: string; icon: string }> = {
  Inquiry: { color: 'var(--text-3)', tint: 'var(--surface-2)', icon: 'ti-mail' },
  Tentative: { color: 'var(--warn)', tint: 'var(--warn-tint)', icon: 'ti-clock' },
  Confirmed: { color: 'var(--green)', tint: 'var(--green-tint)', icon: 'ti-circle-check' },
  Completed: { color: 'var(--info)', tint: 'var(--info-tint)', icon: 'ti-flag-check' },
  Cancelled: { color: 'var(--text-3)', tint: 'var(--surface-2)', icon: 'ti-ban' },
};

export const COI_LABEL: Record<CoiStatus, string> = {
  pending: 'COI not on file',
  received: 'COI on file',
  waived: 'COI waived',
};

export const PAY_LABEL: Record<PayStatus, string> = {
  unpaid: 'Not invoiced',
  invoiced: 'Invoiced',
  paid: 'Paid',
  waived: 'Waived',
};

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

// An active rental is one still on the books — not a dead inquiry or a cancel.
export function isActive(r: Rental): boolean {
  return r.status === 'Tentative' || r.status === 'Confirmed' || r.status === 'Completed';
}

// The outstanding gates for a rental that's actually happening. Inquiries and
// cancellations don't nag — there's nothing to chase yet.
export interface Outstanding {
  coi: boolean; // insurance not yet on file
  deposit: boolean; // deposit required but not paid
  invoice: boolean; // there's a fee and it isn't paid
}
export function outstanding(r: Rental): Outstanding {
  if (!isActive(r)) return { coi: false, deposit: false, invoice: false };
  return {
    coi: r.coi === 'pending',
    deposit: r.deposit > 0 && r.depositStatus !== 'paid' && r.depositStatus !== 'waived',
    invoice: r.fee > 0 && r.invoiceStatus !== 'paid' && r.invoiceStatus !== 'waived',
  };
}
export function outstandingCount(r: Rental): number {
  const o = outstanding(r);
  return (o.coi ? 1 : 0) + (o.deposit ? 1 : 0) + (o.invoice ? 1 : 0);
}

// Insurance is the hard prerequisite to confirm; the rest can trail. Soft though
// — the office can confirm anyway (and the UI lets them) if they have a reason.
export function readyToConfirm(r: Rental): boolean {
  return r.coi !== 'pending';
}

export function rentals(db: Database): Rental[] {
  return db.rentals ?? [];
}

// For the admin dashboard card: active rentals with anything still outstanding.
export function rentalFollowups(db: Database): Rental[] {
  return rentals(db).filter((r) => outstandingCount(r) > 0);
}

// Upcoming, soonest first; cancelled/old completed drop off.
export function upcomingRentals(db: Database, ref: Date = DEMO_TODAY): Rental[] {
  const today = ref.toISOString().slice(0, 10);
  return rentals(db)
    .filter((r) => r.status !== 'Cancelled' && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Total fees on the books that haven't been collected yet — a headline number.
export function uncollectedTotal(db: Database): number {
  return rentals(db)
    .filter((r) => isActive(r) && r.fee > 0 && r.invoiceStatus !== 'paid' && r.invoiceStatus !== 'waived')
    .reduce((sum, r) => sum + r.fee, 0);
}
