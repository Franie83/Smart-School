/**
 * SQLite-backed persistence bridge.
 * localStorage is a cache/offline outbox only; Flask/SQLite is authoritative when online.
 * The outbox is durable across reloads so offline edits are not silently discarded.
 */
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';
const STORAGE_PREFIX = 'smart_register_';
const OUTBOX_KEY = '__smart_register_flask_outbox_v1__';
let writeQueue: Promise<unknown> = Promise.resolve();
let serverAvailable = false;
let initialized = false;
type PendingEntry = { value?: unknown; deleted: boolean; revision: number };
let pendingWrites = new Map<string, PendingEntry>();
let revision = 0;

function localKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}
function parseCache(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}
function persistOutbox(): void {
  try { window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(Array.from(pendingWrites.entries()))); }
  catch (error) { console.error('Unable to persist offline changes queue.', error); }
}
function restoreOutbox(): void {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    pendingWrites = new Map(entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string'));
    for (const [, entry] of pendingWrites) revision = Math.max(revision, Number(entry?.revision) || 0);
  } catch { pendingWrites = new Map(); }
}
async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) throw new Error(`Flask API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
function queuePendingSync(): void {
  if (!initialized || pendingWrites.size === 0) return;
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    for (const [key, entry] of Array.from(pendingWrites.entries())) {
      try {
        if (entry.deleted) {
          await requestJson(`/api/storage/${encodeURIComponent(key)}`, { method: 'DELETE' });
        } else {
          await requestJson(`/api/storage/${encodeURIComponent(key)}`, {
            method: 'PUT', body: JSON.stringify({ value: entry.value }),
          });
        }
        if (pendingWrites.get(key)?.revision === entry.revision) pendingWrites.delete(key);
        persistOutbox();
        serverAvailable = true;
      } catch (error) {
        serverAvailable = false;
        console.warn('SQLite sync deferred; local cache and durable outbox retained.', error);
        break;
      }
    }
  });
}
function enqueueWrite(key: string, value: unknown, deleted = false): void {
  // StorageService writes demo defaults during module construction, before hydration.
  // Those defaults must not enter the outbox and overwrite a populated server database.
  if (!initialized || !key.startsWith(STORAGE_PREFIX)) return;
  pendingWrites.set(key, { value, deleted, revision: ++revision });
  persistOutbox();
  queuePendingSync();
}

restoreOutbox();
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => queuePendingSync());
}

export const appStorage = {
  getItem(key: string): string | null { return window.localStorage.getItem(key); },
  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
    if (key.startsWith(STORAGE_PREFIX)) {
      try { enqueueWrite(key, JSON.parse(value)); }
      catch { enqueueWrite(key, value); }
    }
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
    if (key.startsWith(STORAGE_PREFIX)) enqueueWrite(key, undefined, true);
  },
  get serverAvailable(): boolean { return serverAvailable; },
};

/** Hydrate before rendering. Existing browser data is imported once on first server use. */
export async function initializeServerStorage(authenticatedRole?: string): Promise<void> {
  const cached = Object.fromEntries(localKeys().map((key) => [key, parseCache(key)]));
  try {
    const snapshot = await requestJson('/api/storage');
    const serverItems: Record<string, unknown> = snapshot?.items || {};
    const role = String(authenticatedRole || (serverItems.smart_register_current_user as any)?.role || '').toUpperCase();
    if (role && role !== 'SUPER_ADMIN') {
      // Never import another user's browser cache into a scoped session. Remove stale
      // cross-school cache entries and stale offline outbox writes before rendering.
      pendingWrites = new Map();
      try { window.localStorage.removeItem(OUTBOX_KEY); } catch { /* optional cache */ }
      for (const key of localKeys()) {
        if (!(key in serverItems) || serverItems[key] === null) window.localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(serverItems)) {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(value));
      }
      initialized = true;
      serverAvailable = true;
      persistOutbox();
      return;
    }
    if (Object.keys(serverItems).length === 0 && Object.keys(cached).length > 0) {
      const imported = await requestJson('/api/storage/bulk', {
        method: 'POST', body: JSON.stringify({ items: cached, mode: 'if-empty' }),
      });
      Object.entries(imported.items || {}).forEach(([key, value]) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      });
    } else {
      // Server snapshot is authoritative except keys with known offline edits in the outbox.
      for (const [key, value] of Object.entries(serverItems)) {
        if (!pendingWrites.has(key)) window.localStorage.setItem(key, JSON.stringify(value));
      }
      // If the server has data but a cache contains keys not yet on the server, import only
      // those missing keys. Never overwrite server values with a stale cache snapshot.
      const missing = Object.fromEntries(Object.entries(cached).filter(([key]) =>
        key.startsWith(STORAGE_PREFIX) && !(key in serverItems) && !pendingWrites.has(key)));
      if (Object.keys(missing).length) {
        const merged = await requestJson('/api/storage/bulk', {
          method: 'POST', body: JSON.stringify({ items: missing, mode: 'merge-missing' }),
        });
        Object.entries(merged.items || {}).forEach(([key, value]) => {
          if (!pendingWrites.has(key)) window.localStorage.setItem(key, JSON.stringify(value));
        });
      }
    }
    initialized = true;
    serverAvailable = true;
    persistOutbox();
    await flushServerStorage();
  } catch (error) {
    initialized = true;
    serverAvailable = false;
    console.warn('Flask API unavailable; opening cached local data.', error);
    queuePendingSync();
  }
}
export async function flushServerStorage(): Promise<void> {
  queuePendingSync();
  await writeQueue;
}
