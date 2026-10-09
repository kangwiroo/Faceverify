import { all, first } from './lib/db.js';
import { ayoConfigured } from './lib/ayo.js';
import { googleConfigured } from './lib/google.js';
import { llmConfigured } from './lib/llm.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

function table(cols, rows, resource) {
  const head = cols.map((c) => `<th>${c.label}</th>`).join('') + (resource ? '<th></th>' : '');
  const body = rows.length ? rows.map((r) => {
    const tds = cols.map((c) => `<td>${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('');
    const del = resource ? `<td><form method="post" action="/api/${resource}/${r.id}/delete" onsubmit="return confirm('Hapus data ini?')"><button class="btn danger sm">Hapus</button></form></td>` : '';
    return `<tr>${tds}${del}</tr>`;
  }).join('') : `<tr><td colspan="${cols.length + 1}" class="muted">Belum ada data.</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function form(resource, fields) {
  const inputs = fields.map((f) => {
    if (f.type === 'select') return `<label>${f.label}<select name="${f.key}">${f.options.map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;
    return `<label>${f.label}<input name="${f.key}" type="${f.type || 'text'}" ${f.required ? 'required' : ''}></label>`;
  }).join('');
  return `<form class="form-row" method="post" action="/api/${resource}/create">${inputs}<button class="btn primary">Tambah</button></form>`;
}

function badge(ok, label) {
  return `<span class="chip ${ok ? 'ok' : 'off'}">${ok ? '●' : '○'} ${label} ${ok ? 'terhubung' : 'belum'}</span>`;
}

/* ---------------- Dashboard ---------------- */
export async function dashboard(env) {
  const count = async (t) => (await first(env, `SELECT COUNT(*) n FROM ${t}`)).n;
  const [members, events, staff, posts] = await Promise.all([count('members'), count('events'), count('users'), count('social_posts')]);
  const fin = await all(env, 'SELECT type, amount FROM finance_entries');
  const income = fin.filter((f) => f.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = fin.filter((f) => f.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const card = (k, v, cls = '') => `<div class="card"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  return `
    <div class="cards">
      ${card('Member', members)} ${card('Event', events)} ${card('Staff', staff)} ${card('Post socmed', posts)}
      ${card('Pemasukan', rp(income), 'ok')} ${card('Pengeluaran', rp(expense), 'bad')} ${card('Saldo', rp(income - expense), income - expense >= 0 ? 'ok' : 'bad')}
    </div>
    <h3 class="mt">Status integrasi</h3>
    <div class="chips">
      ${badge(ayoConfigured(env), 'Ayo Indonesia')}
      ${badge(googleConfigured(env), 'Google Workspace')}
      ${badge(llmConfigured(env), 'Nemotron LLM')}
    </div>
    <p class="muted mt">Data booking & transaksi diambil dari Ayo (cache edge). Laporan ke Google Sheets. D1 hanya menyimpan data internal.</p>`;
}

/* ---------------- Resource pages ---------------- */
export async function member(env) {
  const rows = await all(env, 'SELECT * FROM members ORDER BY created_at DESC');
  return form('member', [
    { key: 'name', label: 'Nama', required: true }, { key: 'phone', label: 'Telepon' },
    { key: 'tier', label: 'Tier', type: 'select', options: [['reguler', 'Reguler'], ['vip', 'VIP'], ['vvip', 'VVIP']] },
    { key: 'ayo_member_id', label: 'ID Ayo' },
  ]) + table([
    { key: 'name', label: 'Nama' }, { key: 'phone', label: 'Telepon' }, { key: 'tier', label: 'Tier', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
    { key: 'ayo_member_id', label: 'ID Ayo' },
  ], rows, 'member');
}

export async function event(env) {
  const rows = await all(env, 'SELECT * FROM events ORDER BY starts_at DESC');
  return form('event', [
    { key: 'title', label: 'Judul', required: true }, { key: 'venue', label: 'Venue' },
    { key: 'starts_at', label: 'Mulai', type: 'datetime-local' }, { key: 'ends_at', label: 'Selesai', type: 'datetime-local' },
  ]) + table([
    { key: 'title', label: 'Acara' }, { key: 'venue', label: 'Venue' }, { key: 'starts_at', label: 'Mulai' },
    { key: 'status', label: 'Status', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
  ], rows, 'event');
}

export async function finance(env) {
  const rows = await all(env, 'SELECT * FROM finance_entries ORDER BY date DESC');
  return `<p class="muted">Catatan ringkas. Detail transaksi ditarik dari Ayo & dilaporkan ke Google Sheets.</p>` +
    form('finance', [
      { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'type', label: 'Tipe', type: 'select', options: [['income', 'Pemasukan'], ['expense', 'Pengeluaran']] },
      { key: 'category', label: 'Kategori' }, { key: 'amount', label: 'Jumlah', type: 'number', required: true }, { key: 'note', label: 'Catatan' },
    ]) + table([
      { key: 'date', label: 'Tanggal' }, { key: 'type', label: 'Tipe', fmt: (v) => `<span class="tag ${v}">${v === 'income' ? 'masuk' : 'keluar'}</span>` },
      { key: 'category', label: 'Kategori' }, { key: 'amount', label: 'Jumlah', fmt: rp }, { key: 'note', label: 'Catatan' },
    ], rows, 'finance');
}

export async function socmed(env) {
  const rows = await all(env, 'SELECT * FROM social_posts ORDER BY scheduled_at DESC');
  return form('socmed', [
    { key: 'platform', label: 'Platform', type: 'select', options: [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['x', 'X']] },
    { key: 'caption', label: 'Caption' }, { key: 'scheduled_at', label: 'Jadwal', type: 'datetime-local' },
  ]) + table([
    { key: 'platform', label: 'Platform', fmt: (v) => `<span class="tag">${esc(v)}</span>` }, { key: 'caption', label: 'Caption' },
    { key: 'scheduled_at', label: 'Jadwal' }, { key: 'status', label: 'Status', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
  ], rows, 'socmed');
}

export async function hrd(env) {
  const rows = await all(env, 'SELECT id, name, email, role, active FROM users ORDER BY created_at DESC');
  return `<p class="muted">Kelola staff & peran. Tambah akun staff baru di sini.</p>` +
    form('staff', [
      { key: 'name', label: 'Nama', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'role', label: 'Peran', type: 'select', options: [['kasir', 'Kasir'], ['finance', 'Finance'], ['socmed', 'Social Media'], ['hrd', 'HRD'], ['staff', 'Staff']] },
      { key: 'password', label: 'Kata sandi awal', type: 'password', required: true },
    ]) + table([
      { key: 'name', label: 'Nama' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Peran', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
      { key: 'active', label: 'Aktif', fmt: (v) => (v ? 'ya' : 'tidak') },
    ], rows, 'staff');
}

export async function prestasi(env) {
  const staff = await all(env, "SELECT id, name FROM users WHERE active = 1");
  const opts = staff.map((s) => [s.id, s.name]);
  const ach = await all(env, 'SELECT a.*, u.name staff FROM achievements a JOIN users u ON u.id = a.staff_id ORDER BY a.date DESC');
  const att = await all(env, 'SELECT t.*, u.name staff FROM attendance t JOIN users u ON u.id = t.staff_id ORDER BY t.date DESC LIMIT 50');
  return `<h3>Prestasi</h3>` +
    form('achievement', [
      { key: 'staff_id', label: 'Staff', type: 'select', options: opts }, { key: 'title', label: 'Prestasi', required: true },
      { key: 'points', label: 'Poin', type: 'number' }, { key: 'date', label: 'Tanggal', type: 'date' },
    ]) + table([
      { key: 'staff', label: 'Staff' }, { key: 'title', label: 'Prestasi' }, { key: 'points', label: 'Poin' }, { key: 'date', label: 'Tanggal' },
    ], ach, 'achievement') +
    `<h3 class="mt">Riwayat Absen</h3>` +
    form('attendance', [
      { key: 'staff_id', label: 'Staff', type: 'select', options: opts }, { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'check_in', label: 'Masuk', type: 'time' }, { key: 'check_out', label: 'Keluar', type: 'time' },
      { key: 'status', label: 'Status', type: 'select', options: [['hadir', 'Hadir'], ['telat', 'Telat'], ['izin', 'Izin'], ['alpa', 'Alpa']] },
    ]) + table([
      { key: 'staff', label: 'Staff' }, { key: 'date', label: 'Tanggal' }, { key: 'check_in', label: 'Masuk' },
      { key: 'check_out', label: 'Keluar' }, { key: 'status', label: 'Status', fmt: (v) => `<span class="tag ${v === 'hadir' ? 'income' : 'expense'}">${esc(v)}</span>` },
    ], att, 'attendance');
}

export async function schedule(env) {
  const rows = await all(env, 'SELECT s.*, u.name staff FROM schedules s JOIN users u ON u.id = s.staff_id ORDER BY s.date DESC, s.shift_start LIMIT 100');
  return `
    <form class="form-row" method="post" action="/api/schedule/generate">
      <label>Dari<input name="from" type="date" required></label>
      <label>Sampai<input name="to" type="date" required></label>
      <button class="btn primary">Buat jadwal otomatis</button>
    </form>
    <p class="muted">Penjadwalan dibuat deterministik (round-robin, tanpa biaya LLM). Nemotron hanya dipakai bila kamu minta tinjauan.</p>` +
    table([
      { key: 'date', label: 'Tanggal' }, { key: 'staff', label: 'Staff' }, { key: 'shift_start', label: 'Mulai' },
      { key: 'shift_end', label: 'Selesai' }, { key: 'role', label: 'Peran' },
      { key: 'source', label: 'Sumber', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
    ], rows, 'schedule');
}

export async function kasir(env) {
  const configured = ayoConfigured(env);
  return `
    <div class="cards">
      <div class="card"><div class="k">Sumber booking</div><div class="v">${configured ? 'Ayo Indonesia' : 'Belum tersambung'}</div></div>
    </div>
    <h3 class="mt">Transaksi cepat</h3>
    <form class="form-row" method="post" action="/api/finance/create">
      <input type="hidden" name="type" value="income"><input type="hidden" name="category" value="Kasir">
      <label>Keterangan<input name="note" required></label>
      <label>Jumlah<input name="amount" type="number" required></label>
      <button class="btn primary">Catat pemasukan</button>
    </form>
    <p class="muted">${configured
      ? 'Daftar booking hari ini ditarik dari Ayo (cache edge) — akan tampil setelah endpoint Ayo diisi.'
      : 'Sambungkan Ayo (AYO_BASE_URL + AYO_TOKEN) untuk menarik booking & transaksi.'}</p>`;
}

export async function admin(env) {
  const users = await all(env, 'SELECT name, email, role, active FROM users ORDER BY created_at');
  return `
    <h3>Status integrasi</h3>
    <div class="chips">
      ${badge(ayoConfigured(env), 'Ayo Indonesia')} ${badge(googleConfigured(env), 'Google Workspace')} ${badge(llmConfigured(env), 'Nemotron LLM')}
    </div>
    <h3 class="mt">Pengguna</h3>
    ${table([
      { key: 'name', label: 'Nama' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Peran', fmt: (v) => `<span class="tag">${esc(v)}</span>` },
      { key: 'active', label: 'Aktif', fmt: (v) => (v ? 'ya' : 'tidak') },
    ], users)}
    <p class="muted mt">Tambah/nonaktifkan staff lewat halaman HRD. Rahasia (key Ayo, Google, LLM) diset via <code>wrangler secret put</code>.</p>`;
}
