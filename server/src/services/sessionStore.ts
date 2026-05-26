import crypto from 'crypto';

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** token → expiry timestamp (ms since epoch) */
const store = new Map<string, number>();

export function createSession(): string {
  const token = crypto.randomUUID();
  store.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidSession(token: string): boolean {
  const expiresAt = store.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    store.delete(token);
    return false;
  }
  return true;
}

// Sweep expired sessions once per hour so the Map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of store) {
    if (now > expiresAt) store.delete(token);
  }
}, 60 * 60 * 1000).unref();
