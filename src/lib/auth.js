import { verifyPassword, signSession, verifySession } from './crypto.js';
import { first } from './db.js';

const COOKIE = 'fnh_session';
const MAX_AGE = 60 * 60 * 12; // 12 jam

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.get('cookie') || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export async function currentUser(req, env) {
  const token = parseCookies(req)[COOKIE];
  if (!token || !env.SESSION_SECRET) return null;
  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload) return null;
  return { id: payload.sub, name: payload.name, email: payload.email, role: payload.role };
}

export async function login(env, email, password) {
  const user = await first(env, 'SELECT * FROM users WHERE email = ? AND active = 1', String(email).toLowerCase());
  if (!user) return null;
  if (!(await verifyPassword(password, user.salt, user.hash))) return null;
  const token = await signSession(
    { sub: user.id, name: user.name, email: user.email, role: user.role, exp: Date.now() + MAX_AGE * 1000 },
    env.SESSION_SECRET);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, token };
}

export function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
