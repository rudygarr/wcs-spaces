import type { Database } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE ONE FILE TO SWAP FOR PRODUCTION
 * ─────────────────────────────────────────────────────────────────────────
 *  The whole app reads and writes the database through these three async
 *  functions. The demo implements them with the browser's localStorage so
 *  every edit (new rooms, bookings, staff) survives a refresh on the same
 *  device, with a Reset button to restore the seed.
 *
 *  To ship the real build on Azure Static Web Apps + Microsoft Entra ID:
 *  replace the bodies below with calls to your backend (a Static Web Apps
 *  API function, Microsoft Graph, or any REST/DB layer). Keep the same
 *  `Database` shape and async signatures and NOTHING else in the app has to
 *  change. e.g.
 *
 *     export async function loadDB() {
 *       const r = await fetch('/api/db', { headers: authHeader() });
 *       return r.ok ? await r.json() : null;
 *     }
 *     export async function saveDB(db) {
 *       await fetch('/api/db', { method: 'PUT', body: JSON.stringify(db), headers: authHeader() });
 *     }
 * ─────────────────────────────────────────────────────────────────────────
 */

const KEY = 'wcs-spaces-db-v1';

export async function loadDB(): Promise<Database | null> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Database) : null;
  } catch {
    return null;
  }
}

export async function saveDB(db: Database): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable — demo keeps working in memory
  }
}

export async function clearDB(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
