-- Penyimpanan berkas via Telegram. D1 hanya simpan METADATA + rantai versi.
-- File fisik ada di Telegram (channel bot). Tiap perubahan = versi baru;
-- 5 versi terakhir disimpan sebagai backup (rollback 5 tahap), sisanya dihapus.

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'umum',     -- umum | finance | event | socmed | hrd
  current_version INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  tg_file_id TEXT,                  -- file_id Telegram (untuk unduh)
  tg_message_id INTEGER,            -- message_id (untuk hapus saat prune)
  size INTEGER DEFAULT 0,
  content_type TEXT,
  uploaded_by TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dv_doc ON document_versions(document_id, version);
