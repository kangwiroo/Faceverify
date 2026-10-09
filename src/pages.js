import { all, first, can } from './lib/db.js';
import { ayoConfigured } from './lib/ayo.js';
import { googleConfigured } from './lib/google.js';
import { llmConfigured } from './lib/llm.js';
import { telegramConfigured } from './lib/telegram.js';
import { listDocuments, MAX_VERSIONS } from './lib/docs.js';
import { PAGES, RELATIONS } from './layout.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const rpShort = (n) => { n = Number(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(1) + ' M' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' jt' : n.toLocaleString('id-ID'); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const icon = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;

const SUBTITLE = {
  kasir: 'Transaksi harian & tarik booking dari Ayo Indonesia.',
  finance: 'Arus kas, laporan, dan sinkron ke Google Sheets.',
  socmed: 'Rencana & jadwal konten lintas platform.',
  event: 'Agenda acara venue, terhubung ke kasir, member, dan jadwal staff.',
  member: 'Basis member — bersumber dari Ayo, dipakai kasir & event.',
  schedule: 'Jadwal shift staff (otomatis, hemat biaya LLM).',
  hrd: 'Kelola staff, peran, dan akun.',
  prestasi: 'Prestasi staff & riwayat absensi.',
  admin: 'Status integrasi dan pengguna sistem.',
};

// Chip divisi yang terhubung (bisa diklik).
export function relationChips(page, user) {
  const rel = (RELATIONS[page] || []).filter((p) => can(user.role, p));
  if (!rel.length) return '';
  return `<div class="rel"><span class="faint" style="font-size:12.5px">Terhubung:</span>` +
    rel.map((p) => `<a class="chip" href="/${p}" style="--ac:${PAGES[p].accent}"><span class="dot"></span>${PAGES[p].label}</a>`).join('') + `</div>`;
}

export function header(page, user) {
  const m = PAGES[page];
  return `<div class="hero" style="--accent:${m.accent}">
    <h2>${m.label}</h2><p>${SUBTITLE[page] || ''}</p>${relationChips(page, user)}</div>`;
}

/* ---------- komponen tabel/form ---------- */
function table(cols, rows, resource) {
  const head = cols.map((c) => `<th>${c.label}</th>`).join('') + (resource ? '<th></th>' : '');
  const body = rows.length ? rows.map((r) => {
    const tds = cols.map((c) => `<td>${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('');
    const del = resource ? `<td><form method="post" action="/api/${resource}/${r.id}/delete" onsubmit="return confirm('Hapus?')"><button class="btn danger sm">Hapus</button></form></td>` : '';
    return `<tr>${tds}${del}</tr>`;
  }).join('') : `<tr><td colspan="${cols.length + 1}" class="muted">Belum ada data.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function form(resource, fields) {
  const inputs = fields.map((f) => f.type === 'select'
    ? `<label>${f.label}<select name="${f.key}">${f.options.map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`
    : `<label>${f.label}<input name="${f.key}" type="${f.type || 'text'}" ${f.required ? 'required' : ''}></label>`).join('');
  return `<form class="form-row" method="post" action="/api/${resource}/create">${inputs}<button class="btn accent">Tambah</button></form>`;
}

/* ---------- grafik batang (satu seri, lolos CVD) ---------- */
function barChart(series, color = 'var(--brand)') {
  const W = 640, H = 220, padB = 30, padT = 24, padX = 14;
  const max = Math.max(1, ...series.map((s) => s.value));
  const innerW = W - padX * 2, innerH = H - padB - padT;
  const step = innerW / Math.max(1, series.length);
  const bw = Math.min(46, step * 0.55);
  const bars = series.map((s, i) => {
    const h = (s.value / max) * innerH;
    const x = padX + step * i + (step - bw) / 2;
    const y = padT + innerH - h;
    return `<g><title>${esc(s.label)}: ${rp(s.value)}</title>
      <rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="5" fill="${color}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)">${rpShort(s.value)}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--faint)">${esc(s.label)}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pemasukan per bulan">
    <line x1="${padX}" y1="${padT + innerH}" x2="${W - padX}" y2="${padT + innerH}" stroke="var(--line-2)"/>${bars}</svg>`;
}

function sparkline(values, color) {
  if (!values.length) return '';
  const W = 76, H = 26, max = Math.max(1, ...values), min = Math.min(...values);
  const rng = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1) * W).toFixed(1)},${(H - ((v - min) / rng) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ================= DASHBOARD ================= */
export async function dashboard(env, user) {
  const num = async (t) => (await first(env, `SELECT COUNT(*) n FROM ${t}`)).n;
  const [members, events, staff, posts, sched, ach] = await Promise.all(
    ['members', 'events', 'users', 'social_posts', 'schedules', 'achievements'].map(num));

  const fin = await all(env, 'SELECT date, type, amount, category, created_at FROM finance_entries');
  const byMonth = {};
  fin.forEach((f) => { const k = f.date.slice(0, 7); (byMonth[k] ||= { income: 0, expense: 0 })[f.type] += f.amount; });
  const keys = Object.keys(byMonth).sort();
  const series = keys.map((k) => ({ label: MONTHS[+k.slice(5, 7) - 1], value: byMonth[k].income }));
  const income = fin.filter((f) => f.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = fin.filter((f) => f.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const balance = income - expense;
  const incSeries = series.map((s) => s.value);

  const stat = (ac, ico, k, v, cls, foot) => `<div class="stat" style="--ac:${ac}">
    <div class="top"><span class="ico">${icon(ico)}</span>${k}</div>
    <div class="v ${cls || ''}">${v}</div><div class="foot">${foot || ''}</div></div>`;

  const stats = `<div class="stats">
    ${stat('#f59e0b', 'M4 19V5m4 14V9m4 10V7m4 12v-6', 'Pemasukan', rp(income), 'ok', `${sparkline(incSeries, '#22c55e')}<span class="trend up">▲ bulan ini</span>`)}
    ${stat('#ef4444', 'M4 5v14m4-14v10m4-10v6m4-6v12', 'Pengeluaran', rp(expense), 'bad', '')}
    ${stat('#7c5cff', 'M12 1v22M5 5h9a4 4 0 010 8H8a4 4 0 000 8h9', 'Saldo', rp(balance), balance >= 0 ? 'ok' : 'bad', balance >= 0 ? 'Sehat' : 'Defisit')}
    ${stat('#06b6d4', 'M16 14a4 4 0 10-8 0M12 7a3 3 0 100 6 3 3 0 000-6z', 'Member', members, '', 'total terdaftar')}
  </div>`;

  // feed aktivitas gabungan
  const recent = [];
  (await all(env, 'SELECT name, created_at FROM members ORDER BY created_at DESC LIMIT 3')).forEach((r) => recent.push({ ac: '#06b6d4', ico: 'M16 14a4 4 0 10-8 0M12 7a3 3 0 100 6 3 3 0 000-6z', t: 'Member baru', s: r.name, at: r.created_at }));
  fin.slice(-3).reverse().forEach((r) => recent.push({ ac: r.type === 'income' ? '#22c55e' : '#ef4444', ico: 'M4 19V5m6 14V9m6 10V7', t: r.type === 'income' ? 'Pemasukan' : 'Pengeluaran', s: `${r.category} · ${rp(r.amount)}`, at: r.created_at }));
  (await all(env, 'SELECT a.title, a.created_at, u.name FROM achievements a JOIN users u ON u.id=a.staff_id ORDER BY a.created_at DESC LIMIT 2')).forEach((r) => recent.push({ ac: '#f97316', ico: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z', t: 'Prestasi', s: `${r.name}: ${r.title}`, at: r.created_at }));
  recent.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const feed = recent.slice(0, 6).map((r) => `<div class="row" style="--ac:${r.ac}">
    <span class="fi">${icon(r.ico)}</span><div class="ft"><b>${esc(r.t)}</b><small>${esc(r.s)}</small></div>
    <span class="when">${esc(String(r.at || '').slice(5, 10))}</span></div>`).join('') || '<p class="muted">Belum ada aktivitas.</p>';

  // event mendatang
  const evs = await all(env, "SELECT title, venue, starts_at, status FROM events ORDER BY starts_at DESC LIMIT 4");
  const evList = evs.map((e) => `<div class="litem" style="--ac:#8b5cf6"><span class="mark"></span>
    <div class="lt"><b>${esc(e.title)}</b><small>${esc(e.venue || '-')}</small></div>
    <div class="rt">${esc(String(e.starts_at || '').slice(0, 16))}<br><span class="tag">${esc(e.status)}</span></div></div>`).join('') || '<p class="muted">Belum ada event.</p>';

  // grid divisi
  const docCount = (await first(env, 'SELECT COUNT(*) n FROM documents')).n;
  const counts = { kasir: '—', booking: 'Ayo', finance: rpShort(balance), socmed: posts, event: events, member: members, schedule: sched, hrd: staff, prestasi: ach, docs: docCount, admin: '•' };
  const desc = {
    kasir: 'Transaksi & booking harian', booking: 'Jadwal booking (frame Ayo)', finance: 'Arus kas & laporan', socmed: 'Akun & konten terjadwal',
    event: 'Agenda acara venue', member: 'Basis member Ayo', schedule: 'Shift staff otomatis',
    hrd: 'Staff, peran & bind Ayo', prestasi: 'Prestasi & absen', docs: 'Berkas di Telegram (5 versi)', admin: 'Integrasi & pengguna',
  };
  const divs = Object.keys(PAGES).filter((p) => p !== 'dashboard' && can(user.role, p)).map((p) => {
    const m = PAGES[p];
    return `<a class="divcard" href="/${p}" style="--ac:${m.accent}"><span class="bar-top"></span>
      <span class="ico">${icon(m.icon)}</span><h4>${m.label}</h4><div class="d">${desc[p] || ''}</div>
      <div class="n">${counts[p] ?? ''}</div></a>`;
  }).join('');

  const ic = (ok, label) => `<span class="chip ${ok ? 'ok' : 'off'}">${ok ? '●' : '○'} ${label}</span>`;
  const integ = `<div class="chips" style="margin-top:4px">
    ${ic(ayoConfigured(env), 'Ayo')} ${ic(googleConfigured(env), 'Google')} ${ic(llmConfigured(env), 'Nemotron')} ${ic(telegramConfigured(env), 'Telegram')}</div>`;

  return `
    <div class="hero">
      <h2>Halo, ${esc(user.name.split(' ')[0])} 👋</h2>
      <p>Ringkasan seluruh divisi FiftyNine hari ini. Semua modul saling terhubung — klik kartu untuk masuk.</p>
      ${integ}
    </div>
    ${stats}
    <div class="grid cols-2 mt">
      <div class="card"><h3>Pemasukan per bulan <span class="link">Finance →</span></h3>${barChart(series)}
        <div class="legend"><span><i style="background:var(--brand)"></i>Pemasukan (Rp)</span></div></div>
      <div class="card"><h3>Aktivitas terbaru</h3><div class="feed">${feed}</div></div>
    </div>
    <h3 class="mt" style="margin-bottom:12px">Divisi</h3>
    <div class="divs">${divs}</div>
    <div class="grid cols-2 mt">
      <div class="card"><h3>Event mendatang <span class="link"><a href="/event">Event →</a></span></h3><div class="list">${evList}</div></div>
      <div class="card"><h3>Hubungan antar divisi</h3>
        <p class="muted" style="font-size:13px">Kasir mencatat transaksi → <b>Finance</b>. Event menarik <b>Member</b>, butuh <b>Jadwal</b> staff (HRD), dipromosikan <b>Socmed</b>, dan biayanya masuk <b>Finance</b>.</p>
        <div class="chips">${['kasir', 'finance', 'event', 'member', 'schedule', 'socmed', 'hrd'].filter((p) => can(user.role, p)).map((p) => `<a class="chip" href="/${p}" style="--ac:${PAGES[p].accent}"><span class="dot"></span>${PAGES[p].label}</a>`).join('')}</div>
      </div>
    </div>`;
}

/* ================= DIVISI (D1) ================= */
export async function member(env, user) {
  const rows = await all(env, 'SELECT * FROM members ORDER BY created_at DESC');
  return header('member', user) + form('member', [
    { key: 'name', label: 'Nama', required: true }, { key: 'phone', label: 'Telepon' },
    { key: 'tier', label: 'Tier', type: 'select', options: [['reguler', 'Reguler'], ['vip', 'VIP'], ['vvip', 'VVIP']] },
    { key: 'ayo_member_id', label: 'ID Ayo' },
  ]) + table([
    { key: 'name', label: 'Nama' }, { key: 'phone', label: 'Telepon' },
    { key: 'tier', label: 'Tier', fmt: (v) => `<span class="tag">${esc(v)}</span>` }, { key: 'ayo_member_id', label: 'ID Ayo' },
  ], rows, 'member');
}

export async function event(env, user) {
  const rows = await all(env, 'SELECT * FROM events ORDER BY starts_at DESC');
  return header('event', user) + form('event', [
    { key: 'title', label: 'Judul', required: true }, { key: 'venue', label: 'Venue' },
    { key: 'starts_at', label: 'Mulai', type: 'datetime-local' }, { key: 'ends_at', label: 'Selesai', type: 'datetime-local' },
  ]) + table([
    { key: 'title', label: 'Acara' }, { key: 'venue', label: 'Venue' }, { key: 'starts_at', label: 'Mulai' },
    { key: 'status', label: 'Status', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
  ], rows, 'event');
}

export async function finance(env, user) {
  const rows = await all(env, 'SELECT * FROM finance_entries ORDER BY date DESC');
  return header('finance', user) + form('finance', [
    { key: 'date', label: 'Tanggal', type: 'date' },
    { key: 'type', label: 'Tipe', type: 'select', options: [['income', 'Pemasukan'], ['expense', 'Pengeluaran']] },
    { key: 'category', label: 'Kategori' }, { key: 'amount', label: 'Jumlah', type: 'number', required: true }, { key: 'note', label: 'Catatan' },
  ]) + table([
    { key: 'date', label: 'Tanggal' }, { key: 'type', label: 'Tipe', fmt: (v) => `<span class="tag ${v}">${v === 'income' ? 'masuk' : 'keluar'}</span>` },
    { key: 'category', label: 'Kategori' }, { key: 'amount', label: 'Jumlah', fmt: rp }, { key: 'note', label: 'Catatan' },
  ], rows, 'finance');
}

export async function socmed(env, user) {
  const accounts = await all(env, 'SELECT * FROM social_accounts ORDER BY created_at DESC');
  const rows = await all(env, 'SELECT * FROM social_posts ORDER BY scheduled_at DESC');
  const platforms = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['x', 'X'], ['youtube', 'YouTube']];
  return header('socmed', user) +
    `<h3>🔗 Akun terhubung (binding)</h3>
     <p class="muted" style="margin:-6px 0 12px;font-size:13px">Daftarkan akun socmed yang dikelola. OAuth/token asli disimpan sebagai secret & disempurnakan di lokal.</p>` +
    form('social', [
      { key: 'platform', label: 'Platform', type: 'select', options: platforms },
      { key: 'handle', label: 'Username / handle', required: true },
    ]) + table([
      { key: 'platform', label: 'Platform', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
      { key: 'handle', label: 'Handle', fmt: (v) => '@' + esc(v) },
      { key: 'status', label: 'Status', fmt: (v) => `<span class="tag ${v === 'bound' ? 'aktif' : ''}">${esc(v)}</span>` },
    ], accounts, 'social') +
    `<h3 class="mt">🗓️ Konten terjadwal</h3>` +
    form('socmed', [
      { key: 'platform', label: 'Platform', type: 'select', options: platforms },
      { key: 'caption', label: 'Caption' }, { key: 'scheduled_at', label: 'Jadwal', type: 'datetime-local' },
    ]) + table([
      { key: 'platform', label: 'Platform', fmt: (v) => `<span class="tag">${esc(v)}</span>` }, { key: 'caption', label: 'Caption' },
      { key: 'scheduled_at', label: 'Jadwal' }, { key: 'status', label: 'Status', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
    ], rows, 'socmed');
}

export async function booking(env, user) {
  const url = env.AYO_EMBED_URL || env.AYO_BASE_URL || '';
  const frame = url
    ? `<div class="ayo-frame"><iframe src="${esc(url)}" referrerpolicy="no-referrer" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="Jadwal Booking Ayo"></iframe></div>`
    : `<div class="ayo-frame"><div class="ph">Set <code>AYO_EMBED_URL</code> (atau <code>AYO_BASE_URL</code>) untuk menampilkan jadwal booking Ayo di frame ini.</div></div>`;
  return header('booking', user) +
    `<div class="frame-bar">
       <span class="chip ok">● Jadwal booking langsung dari Ayo</span>
       ${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">Buka di tab baru ↗</a>` : ''}
     </div>` + frame +
    `<p class="muted mt" style="font-size:13px">Catatan: sebagian situs memblokir tampilan dalam iframe (X-Frame-Options/CSP). Jika frame kosong, gunakan "Buka di tab baru", atau minta URL embed resmi dari Ayo.</p>`;
}

export async function hrd(env, user) {
  const rows = await all(env, 'SELECT id, name, email, role, active, ayo_account, ayo_mobile_token FROM users ORDER BY created_at DESC');
  const opts = rows.map((r) => [r.id, r.name]);
  return header('hrd', user) +
    `<h3>➕ Tambah staff</h3>` +
    form('staff', [
      { key: 'name', label: 'Nama', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'role', label: 'Peran', type: 'select', options: [['kasir', 'Kasir'], ['finance', 'Finance'], ['socmed', 'Social Media'], ['hrd', 'HRD'], ['staff', 'Staff']] },
      { key: 'password', label: 'Kata sandi awal', type: 'password', required: true },
    ]) +
    `<h3 class="mt">🔗 Bind akun Ayo AVM</h3>
     <p class="muted" style="margin:-6px 0 12px;font-size:13px">Hubungkan tiap staff ke akun Ayo AVM-nya. Mobile token AVM diperlukan untuk aksi — lihat CATATAN di README (Claude Code mencari cara membacanya dari sesi AVM).</p>
     <form class="form-row" method="post" action="/api/staff/bindayo">
       <label>Staff<select name="user_id">${opts.map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select></label>
       <label>Akun Ayo AVM<input name="ayo_account" placeholder="mis. AVM-12345"></label>
       <label>Mobile token (opsional)<input name="ayo_mobile_token" placeholder="token dari sesi AVM"></label>
       <button class="btn accent">Simpan binding</button>
     </form>` +
    table([
      { key: 'name', label: 'Nama' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Peran', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
      { key: 'ayo_account', label: 'Ayo AVM', fmt: (v) => v ? `<span class="tag aktif">${esc(v)}</span>` : '<span class="faint">—</span>' },
      { key: 'ayo_mobile_token', label: 'Token', fmt: (v) => v ? '<span class="tag aktif">ada</span>' : '<span class="faint">—</span>' },
      { key: 'active', label: 'Aktif', fmt: (v) => `<span class="tag ${v ? 'aktif' : 'alpa'}">${v ? 'ya' : 'tidak'}</span>` },
    ], rows, 'staff');
}

export async function prestasi(env, user) {
  const staff = await all(env, 'SELECT id, name FROM users WHERE active = 1');
  const opts = staff.map((s) => [s.id, s.name]);
  const ach = await all(env, 'SELECT a.*, u.name staff FROM achievements a JOIN users u ON u.id = a.staff_id ORDER BY a.date DESC');
  const att = await all(env, 'SELECT t.*, u.name staff FROM attendance t JOIN users u ON u.id = t.staff_id ORDER BY t.date DESC LIMIT 50');
  return header('prestasi', user) +
    `<h3>🏆 Prestasi</h3>` + form('achievement', [
      { key: 'staff_id', label: 'Staff', type: 'select', options: opts }, { key: 'title', label: 'Prestasi', required: true },
      { key: 'points', label: 'Poin', type: 'number' }, { key: 'date', label: 'Tanggal', type: 'date' },
    ]) + table([
      { key: 'staff', label: 'Staff' }, { key: 'title', label: 'Prestasi' }, { key: 'points', label: 'Poin' }, { key: 'date', label: 'Tanggal' },
    ], ach, 'achievement') +
    `<h3 class="mt">🕑 Riwayat Absen</h3>` + form('attendance', [
      { key: 'staff_id', label: 'Staff', type: 'select', options: opts }, { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'check_in', label: 'Masuk', type: 'time' }, { key: 'check_out', label: 'Keluar', type: 'time' },
      { key: 'status', label: 'Status', type: 'select', options: [['hadir', 'Hadir'], ['telat', 'Telat'], ['izin', 'Izin'], ['alpa', 'Alpa']] },
    ]) + table([
      { key: 'staff', label: 'Staff' }, { key: 'date', label: 'Tanggal' }, { key: 'check_in', label: 'Masuk' },
      { key: 'check_out', label: 'Keluar' }, { key: 'status', label: 'Status', fmt: (v) => `<span class="tag ${v}">${esc(v)}</span>` },
    ], att, 'attendance');
}

export async function schedule(env, user) {
  const rows = await all(env, 'SELECT s.*, u.name staff FROM schedules s JOIN users u ON u.id = s.staff_id ORDER BY s.date DESC, s.shift_start LIMIT 100');
  return header('schedule', user) + `
    <form class="form-row" method="post" action="/api/schedule/generate">
      <label>Dari<input name="from" type="date" required></label>
      <label>Sampai<input name="to" type="date" required></label>
      <button class="btn accent">Buat jadwal otomatis</button>
    </form>
    <p class="muted" style="margin:-6px 0 14px">Deterministik (round-robin) — tanpa biaya LLM. Nemotron hanya dipakai bila kamu minta tinjauan.</p>` +
    table([
      { key: 'date', label: 'Tanggal' }, { key: 'staff', label: 'Staff' }, { key: 'shift_start', label: 'Mulai' },
      { key: 'shift_end', label: 'Selesai' }, { key: 'role', label: 'Peran' }, { key: 'source', label: 'Sumber', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
    ], rows, 'schedule');
}

export async function kasir(env, user) {
  const configured = ayoConfigured(env);
  const today = new Date().toISOString().slice(0, 10);
  const todayIn = (await all(env, "SELECT amount FROM finance_entries WHERE type='income' AND date = ?", today)).reduce((a, b) => a + b.amount, 0);
  return header('kasir', user) + `
    <div class="stats">
      <div class="stat" style="--ac:#10b981"><div class="top"><span class="ico">${icon('M4 7h16v10H4z')}</span>Kas masuk hari ini</div><div class="v ok">${rp(todayIn)}</div></div>
      <div class="stat" style="--ac:#8b5cf6"><div class="top"><span class="ico">${icon('M4 6h16v14H4zM8 3v4M16 3v4')}</span>Sumber booking</div><div class="v" style="font-size:19px">${configured ? 'Ayo Indonesia' : 'Belum tersambung'}</div></div>
    </div>
    <div class="card mt"><h3>Transaksi cepat → Finance</h3>
    <form class="form-row" style="margin:0;border:0;padding:0;background:transparent" method="post" action="/api/finance/create">
      <input type="hidden" name="type" value="income"><input type="hidden" name="category" value="Kasir">
      <label>Keterangan<input name="note" required></label>
      <label>Jumlah<input name="amount" type="number" required></label>
      <button class="btn accent">Catat pemasukan</button>
    </form></div>
    <p class="muted mt">${configured
      ? 'Daftar booking hari ini ditarik dari Ayo (cache edge) — tampil setelah endpoint Ayo diisi.'
      : 'Sambungkan Ayo (AYO_BASE_URL + AYO_TOKEN) untuk menarik booking & transaksi.'}</p>`;
}

const kb = (n) => { n = Number(n || 0); return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB'; };

export async function docs(env, user) {
  const configured = telegramConfigured(env);
  const docs = await listDocuments(env);

  const status = `<span class="chip ${configured ? 'ok' : 'off'}">${configured ? '●' : '○'} Telegram ${configured ? 'terhubung' : 'belum diset'}</span>`;

  const upload = `<form class="card upload" method="post" action="/api/docs/upload" enctype="multipart/form-data">
      <label class="dropzone"><input type="file" name="file" required hidden>
        <span class="dz-ic">${icon('M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2')}</span>
        <span class="dz-name">Pilih atau jatuhkan berkas</span>
        <span class="faint" style="font-size:12px">Disimpan ke Telegram · maks ~50&nbsp;MB</span>
      </label>
      <div class="up-fields">
        <label>Nama dokumen<input name="name" placeholder="(opsional, default nama file)"></label>
        <label>Kategori<select name="category">${['umum', 'finance', 'event', 'socmed', 'hrd'].map((c) => `<option>${c}</option>`).join('')}</select></label>
        <button class="btn accent" ${configured ? '' : 'disabled'}>Unggah / versi baru</button>
      </div>
    </form>`;

  const cards = docs.map((d) => {
    const cur = d.versions.find((v) => v.is_current) || d.versions[d.versions.length - 1];
    const nodes = d.versions.map((v) => `
      <div class="node ${v.is_current ? 'cur' : ''}">
        <div class="nd"></div>
        <div class="nb">
          <b>v${v.version}${v.is_current ? ' · aktif' : ''}</b>
          <small>${esc(String(v.uploaded_at || '').slice(5, 16))} · ${kb(v.size)}</small>
          <div class="na">
            <a class="btn ghost sm" href="/dl/${v.id}">Unduh</a>
            ${v.is_current ? '' : `<form method="post" action="/api/docs/${d.id}/rollback/${v.version}"><button class="btn sm">Pulihkan</button></form>`}
          </div>
        </div>
      </div>`).join('');
    return `<div class="doccard" style="--ac:${PAGES.docs.accent}">
      <div class="dc-head">
        <div class="dc-ic">${icon(PAGES.docs.icon)}</div>
        <div class="dc-meta"><b>${esc(d.name)}</b><small>${esc(d.category)} · v${d.current_version} · diperbarui ${esc(String(d.updated_at || '').slice(0, 10))}</small></div>
        <form method="post" action="/api/docs/${d.id}/delete" onsubmit="return confirm('Hapus dokumen & semua versinya?')"><button class="btn danger sm">Hapus</button></form>
      </div>
      <div class="dc-sub">
        <span class="faint">Riwayat versi (maks ${MAX_VERSIONS} — backup & rollback):</span>
        <form class="newver" method="post" action="/api/docs/upload" enctype="multipart/form-data">
          <input type="hidden" name="name" value="${esc(d.name)}"><input type="hidden" name="category" value="${esc(d.category)}">
          <label class="btn ghost sm">+ Versi baru<input type="file" name="file" required hidden onchange="this.form.submit()"></label>
        </form>
      </div>
      <div class="timeline">${nodes}</div>
    </div>`;
  }).join('') || '<p class="muted">Belum ada dokumen. Unggah berkas pertama di atas.</p>';

  return header('docs', user) +
    `<div class="card" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
       ${status}
       <span class="faint" style="font-size:13px">Semua berkas disimpan di Telegram. Tiap perubahan membuat versi baru; ${MAX_VERSIONS} versi terakhir disimpan sebagai backup (rollback ${MAX_VERSIONS} tahap), sisanya dihapus otomatis.</span>
     </div>` +
    upload +
    `<div class="docgrid">${cards}</div>` +
    (configured ? '' : `<p class="muted mt">Set <code>TELEGRAM_BOT_TOKEN</code> & <code>TELEGRAM_CHAT_ID</code> via <code>wrangler secret put</code> untuk mengaktifkan penyimpanan.</p>`);
}

export async function admin(env, user) {
  const users = await all(env, 'SELECT name, email, role, active FROM users ORDER BY created_at');
  const chip = (ok, label) => `<span class="chip ${ok ? 'ok' : 'off'}">${ok ? '●' : '○'} ${label} ${ok ? 'terhubung' : 'belum'}</span>`;
  return header('admin', user) + `
    <div class="card"><h3>Status integrasi</h3><div class="chips">
      ${chip(ayoConfigured(env), 'Ayo Indonesia')} ${chip(googleConfigured(env), 'Google Workspace')} ${chip(llmConfigured(env), 'Nemotron LLM')}
    </div><p class="muted" style="margin:12px 0 0;font-size:13px">Rahasia diset via <code>wrangler secret put</code> — tidak pernah di Git.</p></div>
    <h3 class="mt" style="margin-bottom:12px">Pengguna</h3>
    ${table([
      { key: 'name', label: 'Nama' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Peran', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
      { key: 'active', label: 'Aktif', fmt: (v) => `<span class="tag ${v ? 'aktif' : 'alpa'}">${v ? 'ya' : 'tidak'}</span>` },
    ], users)}`;
}
