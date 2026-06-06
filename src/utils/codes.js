// Generate a random 6-character room code (uppercase letters + digits, no ambiguous chars).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode() {
  let out = '';
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) out += ALPHABET[arr[i] % ALPHABET.length];
  return out;
}

export function isValidCode(s) {
  return typeof s === 'string' && /^[A-Z2-9]{6}$/.test(s.trim().toUpperCase());
}

export function normalizeCode(s) {
  return (s || '').trim().toUpperCase();
}
