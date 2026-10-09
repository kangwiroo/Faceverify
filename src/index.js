import { currentUser, login, sessionCookie, clearCookie } from './lib/auth.js';
import { can } from './lib/db.js';
import { run } from './lib/db.js';
import { uuid, hashPassword } from './lib/crypto.js';
import { layout, loginPage, NAV } from './layout.js';
import * as pages from './pages.js';
import { generateSchedule } from './lib/schedule.js';

const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
const redirect = (to, headers = {}) => new Response(null, { status: 303, headers: { location: to, ...headers } });

const PAGE_TITLES = Object.fromEntries(NAV.map(([p, label]) => [p, label]));
const PAGE_FN = {
  dashboard: pages.dashboard, kasir: pages.kasir, finance: pages.finance, socmed: pages.socmed,
  event: pages.event, member: pages.member, schedule: pages.schedule, hrd: pages.hrd,
  prestasi: pages.prestasi, admin: pages.admin,
};

// Definisi resource untuk create: tabel + builder baris dari form.
const RESOURCES = {
  member: { table: 'members', page: 'member', build: (f) => ({ name: f.name, phone: f.phone || null, tier: f.tier || 'reguler', ayo_member_id: f.ayo_member_id || null }) },
  event: { table: 'events', page: 'event', build: (f) => ({ title: f.title, venue: f.venue || null, starts_at: f.starts_at || null, ends_at: f.ends_at || null, status: 'rencana' }) },
  finance: { table: 'finance_entries', page: 'finance', build: (f) => ({ date: f.date || new Date().toISOString().slice(0, 10), type: f.type === 'expense' ? 'expense' : 'income', category: f.category || 'Umum', amount: Number(f.amount) || 0, note: f.note || null }) },
  socmed: { table: 'social_posts', page: 'socmed', build: (f) => ({ platform: f.platform || 'instagram', caption: f.caption || null, scheduled_at: f.scheduled_at || null, status: 'draft' }) },
  achievement: { table: 'achievements', page: 'prestasi', build: (f) => ({ staff_id: f.staff_id, title: f.title, points: Number(f.points) || 0, date: f.date || new Date().toISOString().slice(0, 10), note: f.note || null }) },
  attendance: { table: 'attendance', page: 'prestasi', build: (f) => ({ staff_id: f.staff_id, date: f.date || new Date().toISOString().slice(0, 10), check_in: f.check_in || null, check_out: f.check_out || null, status: f.status || 'hadir', note: f.note || null }) },
};
// Tabel yang boleh dihapus lewat /api/<res>/<id>/delete
const DELETABLE = { member: 'members', event: 'events', finance: 'finance_entries', socmed: 'social_posts', achievement: 'achievements', attendance: 'attendance', schedule: 'schedules', staff: 'users' };
const DELETE_PAGE = { member: 'member', event: 'event', finance: 'finance', socmed: 'socmed', achievement: 'prestasi', attendance: 'prestasi', schedule: 'schedule', staff: 'hrd' };

async function insertRow(env, table, row) {
  const cols = ['id', ...Object.keys(row)];
  const placeholders = cols.map(() => '?').join(',');
  await run(env, `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, uuid(), ...Object.values(row));
}

async function handleApi(req, env, user, parts) {
  const [, resource, b, c] = parts; // api / <resource> / (create | <id>/delete | generate)
  const form = Object.fromEntries((await req.formData()).entries());

  // Penjadwalan otomatis
  if (resource === 'schedule' && b === 'generate') {
    if (!can(user.role, 'schedule')) return new Response('forbidden', { status: 403 });
    await generateSchedule(env, { from: form.from, to: form.to });
    return redirect('/schedule');
  }

  // Tambah staff (users) — perlu hash kata sandi
  if (resource === 'staff' && b === 'create') {
    if (!can(user.role, 'hrd')) return new Response('forbidden', { status: 403 });
    const { salt, hash } = await hashPassword(form.password || 'password123');
    await insertRow(env, 'users', { name: form.name, email: String(form.email).toLowerCase(), role: form.role || 'staff', salt, hash, active: 1 });
    return redirect('/hrd');
  }

  // Create generik
  if (b === 'create' && RESOURCES[resource]) {
    const def = RESOURCES[resource];
    if (!can(user.role, def.page)) return new Response('forbidden', { status: 403 });
    await insertRow(env, def.table, def.build(form));
    return redirect('/' + def.page);
  }

  // Delete generik: /api/<res>/<id>/delete
  if (c === 'delete' && DELETABLE[resource]) {
    if (!can(user.role, DELETE_PAGE[resource])) return new Response('forbidden', { status: 403 });
    await run(env, `DELETE FROM ${DELETABLE[resource]} WHERE id = ?`, b);
    return redirect('/' + DELETE_PAGE[resource]);
  }

  return new Response('not found', { status: 404 });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const parts = path.split('/').filter(Boolean);

    // Auth routes
    if (path === '/login' && req.method === 'POST') {
      if (!env.SESSION_SECRET) return html(loginPage('SESSION_SECRET belum diset (wrangler secret put SESSION_SECRET).'));
      const f = Object.fromEntries((await req.formData()).entries());
      const r = await login(env, f.email, f.password);
      if (!r) return html(loginPage('Email atau kata sandi salah.'), 401);
      return redirect('/dashboard', { 'set-cookie': sessionCookie(r.token) });
    }
    if (path === '/logout' && req.method === 'POST') return redirect('/login', { 'set-cookie': clearCookie() });

    const user = await currentUser(req, env);
    if (path === '/login') return user ? redirect('/dashboard') : html(loginPage());
    if (!user) {
      if (path.startsWith('/api/')) return new Response('unauthorized', { status: 401 });
      return redirect('/login');
    }

    // API
    if (parts[0] === 'api') {
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
      return handleApi(req, env, user, parts);
    }

    // Halaman
    if (path === '/') return redirect('/dashboard');
    const page = parts[0];
    if (PAGE_FN[page]) {
      if (!can(user.role, page)) return html(layout({ user, active: page, title: 'Akses ditolak', body: '<p class="err">Peran kamu tidak punya akses ke halaman ini.</p>' }), 403);
      const body = await PAGE_FN[page](env, user);
      return html(layout({ user, active: page, title: PAGE_TITLES[page], body }));
    }

    // Aset statis (fallback) — biasanya sudah ditangani binding [assets]
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
  },
};
