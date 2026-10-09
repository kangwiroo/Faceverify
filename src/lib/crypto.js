// Kripto berbasis Web Crypto (tersedia di Cloudflare Workers).
// PBKDF2 untuk kata sandi, HMAC-SHA256 untuk tanda tangan sesi.

const enc = new TextEncoder();

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

export async function pbkdf2(password, saltHex, iterations = 100000, bytes = 32) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' }, key, bytes * 8);
  return toHex(bits);
}

export async function hashPassword(password) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pbkdf2(password, salt);
  return { salt, hash };
}

export async function verifyPassword(password, saltHex, expectedHex) {
  const hash = await pbkdf2(password, saltHex);
  // perbandingan waktu-tetap
  if (hash.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJSON = (obj) => b64url(enc.encode(JSON.stringify(obj)));

// Token sesi mandiri: payload base64url + tanda tangan HMAC.
export async function signSession(payload, secret) {
  const body = b64urlJSON(payload);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  if (b64url(expected) !== sig) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export const uuid = () => crypto.randomUUID();
