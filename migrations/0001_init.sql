-- FiftyNineHub — skema D1 awal.
-- Prinsip: D1 hanya menyimpan data yang TIDAK ada di Ayo Indonesia
-- (staff, peran, jadwal, absen, prestasi, socmed, catatan internal).
-- Data booking/transaksi berat tetap di Ayo + Google Sheets.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,            -- master_admin | kasir | finance | socmed | hrd | staff
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Member (cache ringan; sumber utama Ayo). ayo_member_id = referensi ke Ayo.
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  ayo_member_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  tier TEXT DEFAULT 'reguler',
  joined_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT DEFAULT 'rencana',   -- rencana | berjalan | selesai | batal
  ayo_ref TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Penjadwalan shift staff (bisa dihasilkan tools penjadwal / LLM)
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  shift_start TEXT,
  shift_end TEXT,
  role TEXT,
  status TEXT DEFAULT 'terjadwal',
  source TEXT DEFAULT 'manual',    -- manual | auto | llm
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Riwayat absen staff
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT DEFAULT 'hadir',     -- hadir | telat | izin | alpa
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prestasi staff
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  title TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  date TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catatan keuangan internal (ringkas). Detail transaksi di Ayo/Google Sheets.
CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,              -- income | expense
  category TEXT,
  amount REAL NOT NULL,
  note TEXT,
  ayo_ref TEXT,
  sheet_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jadwal/draft konten social media
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,          -- instagram | tiktok | facebook | x
  caption TEXT,
  media_key TEXT,                  -- key file di R2
  scheduled_at TEXT,
  status TEXT DEFAULT 'draft',     -- draft | terjadwal | tayang
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pengaturan non-rahasia (id sheet/doc, dsb.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Jejak audit tindakan penting
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  detail TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sched_staff_date ON schedules(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_att_staff_date ON attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_fin_date ON finance_entries(date);

-- Akun master admin bawaan (GANTI setelah login pertama).
-- email: admin@fiftynine.id  |  kata sandi: admin123
INSERT OR IGNORE INTO users (id, name, email, role, salt, hash) VALUES
  ('u-admin', 'Master Admin', 'admin@fiftynine.id', 'master_admin',
   'd6e9189820cd23ad80d75ff78f042d02',
   'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903');
