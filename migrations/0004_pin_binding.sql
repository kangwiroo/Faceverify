-- Login PIN 8 digit (tanpa email), bind akun Ayo AVM per user, dan akun socmed.
--
-- PIN disimpan dua bentuk: pin_lookup = sha256(pin) untuk cari akun O(1),
-- pin_hash = PBKDF2(pin, pin_salt) untuk verifikasi. PIN 8 digit entropinya
-- rendah (10^8) — produksi perlu rate-limit/lockout (sudah ada penghitung
-- percobaan sederhana) dan sebaiknya pepper per-perangkat.

ALTER TABLE users ADD COLUMN pin_lookup TEXT;
ALTER TABLE users ADD COLUMN pin_salt TEXT;
ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN ayo_account TEXT;          -- akun Ayo AVM yang di-bind
ALTER TABLE users ADD COLUMN ayo_mobile_token TEXT;     -- mobile token AVM (lihat CATATAN di README)

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pin ON users(pin_lookup);

-- Akun social media yang terhubung (binding). OAuth asli disempurnakan di lokal.
CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,          -- instagram | tiktok | facebook | x | youtube
  handle TEXT NOT NULL,
  status TEXT DEFAULT 'bound',     -- bound | expired
  access_ref TEXT,                 -- referensi token (disimpan di secret store, bukan di sini)
  bound_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PIN demo (GANTI setelah dipakai). admin=12345678, lainnya 2001000x.
UPDATE users SET pin_lookup='ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', pin_salt='9bcf7a9daadfdc2360e497acc5de1916', pin_hash='55bfdb8b456d7224b6d132b4c259cd14f59f4b0bfe07230fff190d7bff41eaf3', ayo_account='AVM-ADMIN' WHERE id='u-admin';
UPDATE users SET pin_lookup='2f6633eecf3a0c16ac00f9419100809b20db45a0e16dd76edfc106d70c4299c9', pin_salt='f636ef257a04e1911d04f28b94fe6d91', pin_hash='bb20a9744ff2878f68f0d3337f0fc1b6bc90b8ca24e9d9fe869d5408e9c616cf', ayo_account='AVM-KASIR' WHERE id='u-kasir';
UPDATE users SET pin_lookup='a06f0a27bfb189b6a2d3fc67e74fbba715609380c9414446e971844b265a47cc', pin_salt='7b27bd3e4d9e2b95bab860b374b888d9', pin_hash='f4431214f1f865325c19f515e9f2782a3c1e6bd76b44edcff8310475bef28f8a' WHERE id='u-finance';
UPDATE users SET pin_lookup='ec6282e8d1809ac922fd0ce6580b641ec4123918b305afa34d1d562ff2d9b1e5', pin_salt='42732a6c501aa8febbcb0d5095425944', pin_hash='c12838086d1974a5758276b1df92e8267ce5039a21e4a3c65a09f9a0a7eb4475' WHERE id='u-socmed';
UPDATE users SET pin_lookup='04dcc8d48adcb41efc29b217f11f0fcfed94539709d86f01d489e8658251e117', pin_salt='d2eef5834c761ff2d372ddb0bb4cd44d', pin_hash='ffd2ae45cfac7b73520e5cb0118118dd7c98bcfa8b795964da141f171bc6c39e' WHERE id='u-hrd';
UPDATE users SET pin_lookup='ad856f844a08d2fbaf281c01aaff5c8553af63b0415ee2128d37dca9ba73d881', pin_salt='7e186bdce9a2df8fcc04c6d531e93b1f', pin_hash='d609f4407018f8587ad2837ad7bf85a9eb6c9da1703c7c6f27999308343bb62a' WHERE id='u-staff1';
