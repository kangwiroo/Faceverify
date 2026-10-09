import { currentUser, loginPin, sessionCookie, clearCookie } from './lib/auth.js';
import { can } from './lib/db.js';
import { run } from './lib/db.js';
import { uuid, hashPassword } from './lib/crypto.js';
import { layout, loginPage, PAGES, SECTION_OF } from './layout.js';
import * as pages from './pages.js';
import { generateSchedule } from './lib/schedule.js';
import { uploadVersion, rollback as rollbackDoc, removeDocument, resolveDownload } from './lib/docs.js';

const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
const redirect = (to, headers = {}) => new Response(null, { status: 303, headers: { location: to, ...headers } });

const PAGE_TITLES = Object.fromEntries(Object.entries(PAGES).map(([p, m]) => [p, m.label]));
const PAGE_FN = {
  dashboard: pages.dashboard, kasir: pages.kasir, booking: pages.booking, finance: pages.finance, socmed: pages.socmed,
  event: pages.event, member: pages.member, schedule: pages.schedule, hrd: pages.hrd,
  prestasi: pages.prestasi, docs: pages.docs, admin: pages.admin,
};

// Definisi resource untuk create: tabel + builder baris dari form.
const RESOURCES = {
  member: { table: 'members', page: 'member', build: (f) => ({ name: f.name, phone: f.phone || null, tier: f.tier || 'reguler', ayo_member_id: f.ayo_member_id || null }) },
  event: { table: 'events', page: 'event', build: (f) => ({ title: f.title, venue: f.venue || null, starts_at: f.starts_at || null, ends_at: f.ends_at || null, status: 'rencana' }) },
  finance: { table: 'finance_entries', page: 'finance', build: (f) => ({ date: f.date || new Date().toISOString().slice(0, 10), type: f.type === 'expense' ? 'expense' : 'income', category: f.category || 'Umum', amount: Number(f.amount) || 0, note: f.note || null }) },
  socmed: { table: 'social_posts', page: 'socmed', build: (f) => ({ platform: f.platform || 'instagram', caption: f.caption || null, scheduled_at: f.scheduled_at || null, status: 'draft' }) },
  social: { table: 'social_accounts', page: 'socmed', build: (f) => ({ platform: f.platform || 'instagram', handle: (f.handle || '').replace(/^@/, ''), status: 'bound' }) },
  achievement: { table: 'achievements', page: 'prestasi', build: (f) => ({ staff_id: f.staff_id, title: f.title, points: Number(f.points) || 0, date: f.date || new Date().toISOString().slice(0, 10), note: f.note || null }) },
  attendance: { table: 'attendance', page: 'prestasi', build: (f) => ({ staff_id: f.staff_id, date: f.date || new Date().toISOString().slice(0, 10), check_in: f.check_in || null, check_out: f.check_out || null, status: f.status || 'hadir', note: f.note || null }) },
};
// Tabel yang boleh dihapus lewat /api/<res>/<id>/delete
const DELETABLE = { member: 'members', event: 'events', finance: 'finance_entries', socmed: 'social_posts', social: 'social_accounts', achievement: 'achievements', attendance: 'attendance', schedule: 'schedules', staff: 'users' };
const DELETE_PAGE = { member: 'member', event: 'event', finance: 'finance', socmed: 'socmed', social: 'socmed', achievement: 'prestasi', attendance: 'prestasi', schedule: 'schedule', staff: 'hrd' };

async function insertRow(env, table, row) {
  const cols = ['id', ...Object.keys(row)];
  const placeholders = cols.map(() => '?').join(',');
  await run(env, `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, uuid(), ...Object.values(row));
}

async function handleApi(req, env, user, parts) {
  const [, resource, b, c, d] = parts; // api / <resource> / ...
  const ct = req.headers.get('content-type') || '';
  const fd = ct.includes('form') ? await req.formData() : new FormData();
  const form = Object.fromEntries(fd.entries());

  // Dokumen (storage Telegram)
  if (resource === 'docs') {
    if (!can(user.role, 'docs')) return new Response('forbidden', { status: 403 });
    if (b === 'upload') {
      const file = form.file;
      if (!file || typeof file.arrayBuffer !== 'function') return redirect('/docs');
      const bytes = await file.arrayBuffer();
      try {
        await uploadVersion(env, { name: form.name || file.name || 'dokumen', category: form.category, bytes, contentType: file.type, userId: user.id });
      } catch (err) { return new Response('Upload gagal: ' + err.message, { status: 502 }); }
      return redirect('/docs');
    }
    if (c === 'rollback' && d) { await rollbackDoc(env, b, Number(d)); return redirect('/docs'); }
    if (c === 'delete') { await removeDocument(env, b); return redirect('/docs'); }
    return new Response('not found', { status: 404 });
  }

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

  // Bind akun Ayo AVM + mobile token ke seorang staff
  if (resource === 'staff' && b === 'bindayo') {
    if (!can(user.role, 'hrd')) return new Response('forbidden', { status: 403 });
    await run(env, 'UPDATE users SET ayo_account = ?, ayo_mobile_token = ? WHERE id = ?', form.ayo_account || null, form.ayo_mobile_token || null, form.user_id);
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
   try {
    const url = new URL(req.url);
    const path = url.pathname;
    const parts = path.split('/').filter(Boolean);

    // Auth routes
    if (path === '/login' && req.method === 'POST') {
      if (!env.SESSION_SECRET) return html(loginPage('SESSION_SECRET belum diset (wrangler secret put SESSION_SECRET).'));
      const f = Object.fromEntries((await req.formData()).entries());
      const r = await loginPin(env, f.pin);
      if (!r) return html(loginPage('PIN salah atau akun nonaktif.'), 401);
      return redirect('/dashboard', { 'set-cookie': sessionCookie(r.token) });
    }
    if (path === '/logout' && req.method === 'POST') return redirect('/login', { 'set-cookie': clearCookie() });

    const user = await currentUser(req, env);
    if (path === '/login') return user ? redirect('/dashboard') : html(loginPage());
    if (!user) {
      if (path.startsWith('/api/')) return new Response('unauthorized', { status: 401 });
      return redirect('/login');
    }

    // Unduh berkas dari Telegram (token tidak pernah ke klien)
    if (parts[0] === 'dl' && parts[1] && req.method === 'GET') {
      const dl = await resolveDownload(env, parts[1]).catch(() => null);
      if (!dl) return new Response('berkas tidak ditemukan', { status: 404 });
      const upstream = await fetch(dl.url);
      if (!upstream.ok) return new Response('gagal mengambil berkas', { status: 502 });
      return new Response(upstream.body, { headers: {
        'content-type': dl.type,
        'content-disposition': `attachment; filename="${dl.name.replace(/"/g, '')}"`,
      } });
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
      if (!can(user.role, page)) return html(layout({ user, active: page, title: 'Akses ditolak', section: 'Sistem', body: '<p class="err">Peran kamu tidak punya akses ke halaman ini.</p>' }), 403);
      const body = await PAGE_FN[page](env, user);
      return html(layout({ user, active: page, title: PAGE_TITLES[page], section: SECTION_OF[page] || 'FiftyNineHub', body }));
    }

    // Aset statis (fallback) — biasanya sudah ditangani binding [assets]
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
   } catch (err) {
    return new Response('Kesalahan server: ' + (err && err.message || 'tidak diketahui'), { status: 500 });
   }
  },
};
