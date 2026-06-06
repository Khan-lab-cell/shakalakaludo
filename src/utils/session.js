// sessionStorage-backed identity helpers. Session is keyed per browser tab.

const NAME_KEY = 'ludo:name';
const TOKEN_KEY = 'ludo:session_token';

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
