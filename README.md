# FiftyNineHub

Sistem manajemen venue satu-hub di **Cloudflare Workers + D1 + R2**, disinkron
dengan **Ayo Indonesia (AVM)**, **Google Workspace**, **Telegram** (storage
berkas), dan **Nemotron** (LLM). Semua divisi dalam satu aplikasi, saling terhubung.

> **Repo & branch:** `kangwiroo/Faceverify`, branch **`claude/fiftyninehub`**.
> (Nama repo "Faceverify" dipakai ulang; isinya sekarang FiftyNineHub.)
>
> **Status:** fondasi berjalan di `wrangler dev`. **wrangler/D1/R2/deploy
> dikerjakan di lokal (Claude Code).** `database_id` di `wrangler.toml` masih
> `REPLACE_AFTER_D1_CREATE`.

## 📚 Dokumentasi (baca ini untuk konteks penuh)

- **[`CLAUDE.md`](CLAUDE.md)** — panduan proyek lengkap untuk Claude Code lokal:
  stack, struktur, data model, auth PIN, peran, status integrasi, perintah
  setup/deploy, dan aturan wajib (no secrets di Git).
- **[`docs/NOTES.md`](docs/NOTES.md)** — keputusan desain, asumsi, dan **TODO**,
  termasuk **⚠️ CATATAN mobile token AVM** (menunggu contoh dari user).

### Ringkasan status

| Fitur | Status |
|---|---|
| Login **PIN 8 digit** (tanpa email) | ✅ jalan (admin demo `12345678`) |
| Halaman semua divisi + hak akses per peran | ✅ jalan |
| UI pro, responsif (PC/tablet/HP), **tema gelap/terang** | ✅ jalan |
| **Telegram** storage berkas + **rollback 5 tahap** | ✅ jalan (teruji dgn mock) |
| **Bind akun Ayo AVM** + mobile token per user (HRD) | ✅ simpan; **pemakaian token: TODO** |
| **Social media binding** (akun per platform) | ✅ registry (OAuth asli: TODO) |
| **Jadwal Booking** = iframe Ayo | ✅ (isi `AYO_EMBED_URL`) |
| Endpoint **Ayo** asli (bookings/transaksi) | ⏳ placeholder (`src/lib/ayo.js`) |
| **Google Sheets/Docs**, **Nemotron** round-robin | ✅ kerangka siap, perlu kredensial |

## Halaman

Dashboard · **Kasir** · **Jadwal Booking** (iframe Ayo) · **Finance** ·
**Social Media** (konten + binding akun) · **Event** · **Member** ·
**Penjadwalan** · **HRD** (staff + bind Ayo AVM) · **Prestasi & Riwayat Absen** ·
**Dokumen** (Telegram) · **Master Admin** — login PIN + hak akses per peran
(`master_admin`, `kasir`, `finance`, `socmed`, `hrd`, `staff`).

## Strategi hemat D1 & R2

- **Ayo Indonesia = sumber kebenaran** untuk booking & transaksi. Data **tidak
  diduplikasi** ke D1; diambil on-demand dan di-cache di **Cloudflare Cache API
  (edge, gratis)** dengan TTL pendek (`src/lib/ayo.js`).
- **D1 hanya menyimpan data internal** yang tak ada di Ayo: staff & peran,
  jadwal, absen, prestasi, post socmed, catatan keuangan ringkas.
- **R2 hanya untuk file** (ekspor, media socmed) — bukan data transaksional.
- **Google Sheets/Docs** menampung laporan transaksi & manajerial
  (`src/lib/google.js`), sehingga D1 tetap ramping.
- **LLM dipakai seminimal mungkin**: penjadwalan utama **deterministik**
  (round-robin, tanpa biaya); Nemotron hanya dipanggil bila diminta meninjau.

## Login PIN, bind Ayo AVM, dan frame booking

- **Login PIN 8 digit** (tanpa email). Akun dicari lewat `sha256(pin)` lalu
  diverifikasi PBKDF2. PIN demo: **admin = `12345678`**, staff = `2001000x`.
  > PIN 8 digit entropinya rendah — tambahkan rate-limit/lockout dan pepper
  > per-perangkat saat produksi (disempurnakan di lokal).
- **Bind akun Ayo AVM per user** (halaman HRD): tiap staff punya `ayo_account`
  dan `ayo_mobile_token`.
- **Jadwal Booking** (halaman tersendiri): menampilkan Ayo dalam **iframe**.
  Set `AYO_EMBED_URL`. Jika Ayo memblokir iframe (X-Frame-Options/CSP), sediakan
  URL embed resmi, atau pakai tombol "Buka di tab baru".
- **Social media binding** (halaman Social Media): daftar akun terhubung per
  platform; OAuth/token asli disimpan sebagai secret.

### ⚠️ CATATAN untuk Claude Code (lokal) — mobile token AVM

AVM Ayo membutuhkan **mobile token** untuk melakukan aktivitas. Token ini bisa
dibaca ketika user sudah login ke situs AVM. **Contoh mobile token akan
diberikan menyusul.** Tugas lokal:

1. Cari cara membaca/menyegarkan mobile token dari sesi AVM (contoh menyusul).
2. Simpan per user di `users.ayo_mobile_token` (sudah ada kolomnya) atau sebagai
   secret bila lebih aman.
3. Saat aksi ke AVM, tempelkan token pada request/link aksi ke Ayo.

Saat ini sistem hanya **menyimpan** token (lewat halaman HRD) dan menyediakan
kolomnya; pemakaian token ke API/aksi AVM diselesaikan setelah contoh ada.

## Storage berkas: Telegram (5 tahap rollback)

Semua dokumen/berkas disimpan di **Telegram** (bot → channel privat), bukan di
D1/R2. D1 hanya menyimpan metadata + rantai versi (`src/lib/telegram.js`,
`src/lib/docs.js`).

- Unggah berkas → bot mengirimnya ke channel, `file_id` + `message_id` disimpan.
- Unggah berkas dengan **nama sama** = **versi baru**; versi lama jadi **backup**.
- Disimpan maksimal **5 versi** terbaru → **rollback 5 tahap**. Versi lebih tua
  dihapus otomatis (pesan Telegram ikut dihapus).
- Unduh lewat route `/dl/<versionId>` yang mem-proxy dari Telegram, sehingga
  token bot **tidak pernah** sampai ke browser.
- Halaman **Dokumen** menampilkan timeline versi dengan tombol Unduh & Pulihkan.

Batas bot API ~50 MB/berkas (bisa lebih besar dengan bot-API self-hosted via
`TELEGRAM_API_BASE`).

## LLM round-robin (Nemotron Ultra)

`src/lib/llm.js` membaca `LLM_API_KEYS` (secret, dipisah koma), memakai
`LLM_ACTIVE_KEYS` pertama secara **bergiliran** dengan **failover** otomatis ke
key berikutnya saat 429/5xx. Endpoint OpenAI-compatible (`LLM_BASE_URL`),
default NVIDIA API untuk `nvidia/llama-3.1-nemotron-ultra-253b-v1`.

## Keamanan kredensial

**Tidak ada API key di Git.** Semua rahasia diset sebagai Wrangler secrets:

```bash
wrangler secret put SESSION_SECRET
wrangler secret put LLM_API_KEYS     # "key1,key2,...,key20"
wrangler secret put AYO_TOKEN
wrangler secret put GOOGLE_SA_JSON   # isi JSON service account
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

## Setup & jalankan

```bash
npm install

# 1) Buat D1 lalu salin database_id ke wrangler.toml
npm run db:create
# 2) Migrasi skema (buat tabel + akun admin)
npm run db:migrate:local      # lokal
# 3) Buat bucket R2
npm run r2:create
# 4) Dev lokal
cp .dev.vars.example .dev.vars   # isi SESSION_SECRET minimal
npm run dev
```

Login awal: **admin@fiftynine.id / admin123** (ganti setelah masuk).

Deploy:

```bash
npm run db:migrate           # migrasi D1 remote
npm run deploy               # ke fiftynine.workers.dev
```

## Struktur

| Path | Isi |
| ---- | --- |
| `wrangler.toml` | Konfigurasi Worker, D1, R2, vars |
| `migrations/` | Skema D1 (SQL) + akun admin awal |
| `src/index.js` | Router Worker: auth, halaman, API |
| `src/layout.js` | Kerangka HTML + navigasi per peran |
| `src/pages.js` | Render tiap halaman |
| `src/lib/auth.js`, `crypto.js` | Login, sesi, hash kata sandi |
| `src/lib/db.js` | Helper D1 + peta peran→halaman |
| `src/lib/ayo.js` | Konektor Ayo (cache edge) |
| `src/lib/google.js` | Konektor Google Sheets/Docs |
| `src/lib/llm.js` | Gateway LLM round-robin |
| `src/lib/schedule.js` | Penjadwalan deterministik (+LLM opsional) |
| `public/` | CSS/JS statis |

## Langkah berikutnya (disempurnakan di lokal)

1. Isi endpoint Ayo resmi di `src/lib/ayo.js` + tampilkan booking di Kasir.
2. Hubungkan laporan Finance → Google Sheets (ID sheet di `settings`).
3. Penjadwal socmed → R2 untuk media + tayang terjadwal (Cron Trigger).
4. Edit data & pencarian tabel; audit log untuk tindakan penting.
5. Cron Trigger untuk tarik ringkasan Ayo harian ke Sheets.
