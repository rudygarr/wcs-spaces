// The IT "Problem Type" taxonomy, captured 1:1 from WCS's live SchoolDude /
// Brightly "Incident" requester portal (Step 3 icon grid). Parity is the wedge:
// the new system must offer everything the current setup does before IT will
// talk about switching, so all 20 ship — but we curate a short "common" set up
// front and tuck the long tail behind a "More…" expander (the real portal dumps
// all 20 at once). Miscellaneous is the always-available catch-all.
//
// `glyph` is a Tabler icon name (ti ti-*). `common: true` surfaces it in the
// featured grid; everything else lives under "More problem types."

export interface ITProblemType {
  name: string;
  glyph: string;
  common?: boolean;
}

export const IT_PROBLEM_TYPES: ITProblemType[] = [
  // ---- Featured: the issues WCS staff actually file most ----
  { name: 'Password', glyph: 'ti-key', common: true },
  { name: 'Internet Connection', glyph: 'ti-wifi', common: true },
  { name: 'CPU / Computer', glyph: 'ti-device-desktop', common: true },
  { name: 'Audio / Visual', glyph: 'ti-volume', common: true },
  { name: 'Projector', glyph: 'ti-device-tv', common: true },
  { name: 'Printers', glyph: 'ti-printer', common: true },
  { name: 'Software Request', glyph: 'ti-apps', common: true },
  { name: 'Email', glyph: 'ti-mail', common: true },
  { name: 'Interactive White Board', glyph: 'ti-presentation', common: true },
  { name: 'Telephone Services', glyph: 'ti-phone', common: true },
  // ---- The long tail (parity with the full Incident grid) ----
  { name: 'Alarm Bell', glyph: 'ti-bell-ringing' },
  { name: 'Copier', glyph: 'ti-copy' },
  { name: 'Equipment Checkout', glyph: 'ti-package' },
  { name: 'Fax', glyph: 'ti-printer' },
  { name: 'Grades / Comments', glyph: 'ti-clipboard-text' },
  { name: 'LMS', glyph: 'ti-school' },
  { name: 'New Equipment Request', glyph: 'ti-shopping-cart' },
  { name: 'Scanner', glyph: 'ti-scan' },
  { name: 'Student Hardware', glyph: 'ti-device-laptop' },
  // Catch-all — always last, always shown.
  { name: 'Miscellaneous / Questions', glyph: 'ti-help' },
];

// Quick lookup: glyph for a given problem-type name (falls back to a generic
// wrench so re-tagged or legacy types still render an icon in the pool).
export function itGlyph(type?: string): string {
  if (!type) return 'ti-tool';
  return IT_PROBLEM_TYPES.find((t) => t.name === type)?.glyph ?? 'ti-tool';
}

// WCS's IT emergency contact, straight off the live SchoolDude form. A ticket
// flagged Emergency dual-routes here AND to the whole team.
export const IT_EMERGENCY_CONTACT = { name: 'Omar Valerio', phone: '786-606-4960' };
