// Identity + room-context helpers.
// - Name persists in sessionStorage (same browser tab, can change between rooms).
// - Session token is a per-attempt random ID used as the players.session_token
//   unique key. It MUST be unique per DB row, so we generate a fresh one
//   every time the user creates or joins a room.
// - Player ID is the Supabase-issued UUID for our row in the players table.
//   Stored in sessionStorage so the lobby / game can re-find us across
//   remounts and refreshes of the same tab.

const NAME_KEY = 'ludo:name';
const TOKEN_KEY = 'ludo:session_token';
const PLAYER_ID_KEY = 'ludo:player_id';

export function getName() {
  return sessionStorage.getItem(NAME_KEY) || '';
}
export function setName(name) {
  const cleaned = (name || '').trim().slice(0, 16);
  sessionStorage.setItem(NAME_KEY, cleaned);
  return cleaned;
}

export function getSessionToken() {
  let t = sessionStorage.getItem(TOKEN_KEY);
  if (!t) {
    const arr = new Uint32Array(4);
    crypto.getRandomValues(arr);
    t = Array.from(arr, (n) => n.toString(16).padStart(8, '0')).join('');
    sessionStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

// Force a brand-new session token. Call this right before inserting a new
// players row to guarantee uniqueness across multiple create/join attempts
// in the same tab.
export function rotateSessionToken() {
  const arr = new Uint32Array(4);
  crypto.getRandomValues(arr);
  const t = Array.from(arr, (n) => n.toString(16).padStart(8, '0')).join('');
  sessionStorage.setItem(TOKEN_KEY, t);
  return t;
}

export function getPlayerId() {
  return sessionStorage.getItem(PLAYER_ID_KEY) || null;
}
export function setPlayerId(id) {
  if (id) sessionStorage.setItem(PLAYER_ID_KEY, id);
  else sessionStorage.removeItem(PLAYER_ID_KEY);
}

export function clearPlayer() {
  sessionStorage.removeItem(PLAYER_ID_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
