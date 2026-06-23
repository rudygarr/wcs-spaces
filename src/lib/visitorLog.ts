import { useSyncExternalStore } from 'react';
import type { VisitorEntry } from './types';

// PRIVACY BOUNDARY (security-visitor-scope): the visitor log is the one place a
// real guest's name is entered, so it must never touch disk. This store keeps
// entries in a plain module-level array — no localStorage, no Database, no
// persistence. The list survives navigation within a session but clears on
// reload, exactly as a privacy-preserving door log should in a public demo.
//
// In production this would post to a server-side, access-controlled record with
// a retention policy; the client never being the system of record is the point.

let entries: VisitorEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let seq = 0;
export function logVisitor(e: Omit<VisitorEntry, 'id'>): VisitorEntry {
  const entry: VisitorEntry = { ...e, id: `vis-${++seq}` };
  // Newest first.
  entries = [entry, ...entries];
  emit();
  return entry;
}

export function checkOutVisitor(id: string, atHHMM: string) {
  entries = entries.map((v) => (v.id === id ? { ...v, checkOutAt: atHHMM } : v));
  emit();
}

export function clearVisitorLog() {
  entries = [];
  emit();
}

// React hook — re-renders consumers when the in-memory log changes.
export function useVisitorLog(): VisitorEntry[] {
  return useSyncExternalStore(subscribe, () => entries, () => entries);
}
