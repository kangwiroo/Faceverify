// Penjadwalan shift — DETERMINISTIK dulu (tanpa LLM), hemat biaya.
// LLM (Nemotron) hanya dipanggil bila diminta untuk menyempurnakan/menjelaskan,
// sesuai permintaan "minimal usage LLM".

import { all, run } from './db.js';
import { uuid } from './crypto.js';
import { chat, llmConfigured } from './llm.js';

const SHIFTS = [
  { role: 'kasir', start: '08:00', end: '16:00' },
  { role: 'kasir', start: '16:00', end: '23:00' },
  { role: 'staff', start: '09:00', end: '17:00' },
];

function datesBetween(from, to) {
  const out = [];
  const d = new Date(from), end = new Date(to);
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}

// Bagikan shift ke staff secara bergiliran (round-robin) — adil & tanpa LLM.
export async function generateSchedule(env, { from, to }) {
  const staff = await all(env, "SELECT id, name, role FROM users WHERE active = 1 AND role IN ('kasir','staff','hrd')");
  if (!staff.length) return { created: 0, note: 'Belum ada staff untuk dijadwalkan' };

  const days = datesBetween(from, to);
  let idx = 0, created = 0;
  for (const date of days) {
    for (const shift of SHIFTS) {
      const pool = staff.filter((s) => shift.role === 'staff' || s.role === shift.role || s.role === 'hrd');
      const who = (pool.length ? pool : staff)[idx % (pool.length || staff.length)];
      idx++;
      await run(env,
        'INSERT INTO schedules (id, staff_id, date, shift_start, shift_end, role, status, source) VALUES (?,?,?,?,?,?,?,?)',
        uuid(), who.id, date, shift.start, shift.end, shift.role, 'terjadwal', 'auto');
      created++;
    }
  }
  return { created, days: days.length };
}

// Opsional: minta Nemotron meninjau keseimbangan jadwal (1 panggilan saja).
export async function reviewScheduleWithLLM(env, { from, to }) {
  if (!llmConfigured(env)) return { skipped: true, reason: 'LLM belum dikonfigurasi' };
  const rows = await all(env,
    'SELECT s.date, s.shift_start, s.shift_end, s.role, u.name FROM schedules s JOIN users u ON u.id = s.staff_id WHERE s.date BETWEEN ? AND ? ORDER BY s.date',
    from, to);
  const content = await chat(env, [
    { role: 'system', content: 'Anda asisten operasional venue. Tinjau jadwal, sebut ketimpangan beban dan saran singkat. Jawab ringkas dalam bahasa Indonesia.' },
    { role: 'user', content: `Jadwal ${from} s/d ${to}:\n${rows.map((r) => `${r.date} ${r.shift_start}-${r.shift_end} ${r.role} = ${r.name}`).join('\n')}` },
  ], { maxTokens: 400 });
  return { review: content };
}
