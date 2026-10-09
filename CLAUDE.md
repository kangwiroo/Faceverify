# CLAUDE.md — FiftyNineHub

Panduan untuk Claude Code (lokal). Baca ini dulu sebelum mengubah apa pun.

> **Repo & branch:** `kangwiroo/Faceverify`, branch **`claude/fiftyninehub`**.
> (Repo bernama "Faceverify" karena dipakai ulang; isinya sekarang FiftyNineHub.)
> Dibangun di cloud session; **wrangler/D1/R2/deploy dikerjakan di lokal.**

## Apa ini

**FiftyNineHub** — sistem manajemen venue satu-hub untuk FiftyNine, berjalan di
**Cloudflare Workers + D1 + R2**, disinkron dengan **Ayo Indonesia (AVM)**,
**Google Workspace**, **Telegram** (storage berkas), dan **Nemotron** (LLM).
Semua divisi dalam satu aplikasi dan saling terhubung.

## Tumpukan & gaya

- **Cloudflare Worker** (`src/index.js` sebagai entry), **tanpa dependensi runtime**
  (hanya `wrangler` sebagai devDependency). Jangan tambah framework berat tanpa alasan.
- **Server-rendered HTML** (bukan SPA): tiap halaman = fungsi di `src/pages.js`
  yang mengembalikan string HTML, dibungkus `src/layout.js`.
- **D1** untuk data internal, **R2** disiapkan (file utama di Telegram),
  **Assets** untuk `public/` (CSS/JS statis).
- Teks UI **Bahasa Indonesia**.

## Menjalankan (lokal)

```bash
npm install
npm run db:create            # buat D1, SALIN database_id ke wrangler.toml
npm run db:migrate:local     # terapkan migrations ke D1 lokal
npm run r2:create            # buat bucket R2
cp .dev.vars.example .dev.vars   # isi minimal SESSION_SECRET
npm run dev                  # wrangler dev -> http://localhost:4000
# deploy:
npm run db:migrate           # migrasi D1 remote
npm run deploy               # ke fiftynine.workers.dev
```

Login: **PIN 8 digit** (lihat Auth). Admin demo: **`12345678`**.

## Struktur

```
wrangler.toml            # config Worker, D1, R2, vars (non-rahasia)
migrations/              # skema D1 (urut 0001..0004)
src/
  index.js               # router: auth, halaman, API, /dl, /do-ready
  layout.js              # PAGES (nav+aksen), SECTIONS, RELATIONS, layout(), loginPage()
  pages.js               # render tiap halaman + komponen (tabel, form, chart, timeline)
  lib/
    crypto.js            # PBKDF2, HMAC sesi, sha256 (lookup PIN)
    auth.js              # loginPin(), sesi cookie
    db.js                # helper D1 + ROLES (peran -> halaman)
    telegram.js          # storage berkas (sendDocument/getFile/deleteMessage)
    docs.js              # versioning dokumen (maks 5 versi / rollback 5 tahap)
    ayo.js               # konektor Ayo (cache edge) — endpoint masih placeholder
    google.js            # Google Sheets/Docs via service account
    llm.js               # gateway round-robin Nemotron
    schedule.js          # penjadwalan deterministik (+LLM opsional)
public/                  # app.css, app.js (tema, PIN pad, dropzone)
docs/NOTES.md            # catatan keputusan + TODO (BACA untuk konteks)
```

## Data model (migrations)

- `0001_init.sql` — users, members, events, schedules, attendance, achievements,
  finance_entries, social_posts, settings, audit_log (+ admin awal).
- `0002_demo_seed.sql` — data demo (bisa dihapus untuk produksi). Staff demo
  memakai hash/PIN yang sama polanya.
- `0003_documents.sql` — documents + document_versions (storage Telegram).
- `0004_pin_binding.sql` — kolom PIN & Ayo pada users, index PIN unik, tabel
  social_accounts, dan PIN demo.

## Auth — PIN 8 digit

- **Login dengan PIN saja** (tanpa email). Akun dicari via `sha256(pin)`
  (`users.pin_lookup`, index unik) lalu diverifikasi PBKDF2 (`pin_salt`,`pin_hash`).
- PIN demo: admin `12345678`; staff `20010001`..`20010005`.
- Sesi = cookie `fnh_session` (HMAC, 12 jam) via `SESSION_SECRET`.
- **Peran & akses** diatur di `src/lib/db.js` → `ROLES` (peran → daftar halaman).
  Peran: `master_admin, kasir, finance, socmed, hrd, staff`.
- ⚠️ **PIN 8 digit entropinya rendah** — lihat TODO (rate-limit/lockout/pepper).

## Halaman (divisi)

Dashboard · Kasir · **Jadwal Booking** (iframe Ayo) · Finance · Social Media
(konten + **binding akun**) · Event · Member · Penjadwalan · HRD (staff +
**bind Ayo AVM**) · Prestasi & Absen · **Dokumen** (Telegram) · Master Admin.
Tiap halaman punya header ber-aksen + chip **"Terhubung"** (relasi antar divisi,
diatur di `RELATIONS` pada `layout.js`).

## Integrasi — status & secret

| Integrasi | Status | Secret / Var |
|---|---|---|
| **Ayo (AVM)** | Konektor + cache edge siap; **endpoint & auth masih placeholder** (`src/lib/ayo.js`). Frame booking pakai `AYO_EMBED_URL`. | `AYO_TOKEN` (secret), `AYO_BASE_URL`/`AYO_EMBED_URL` (var) |
| **Telegram** | **Jalan** — storage berkas + 5 versi rollback (teruji dgn mock). | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (secret); `TELEGRAM_API_BASE` (var opsional) |
| **Google** | JWT service account + append Sheets siap; perlu kredensial + ID sheet. | `GOOGLE_SA_JSON` (secret) |
| **Nemotron (LLM)** | Gateway round-robin + failover siap; dipakai **minimal** (hanya penjadwalan). | `LLM_API_KEYS` (secret, koma); `LLM_BASE_URL`/`LLM_MODEL`/`LLM_ACTIVE_KEYS` (var) |

## Prinsip hemat D1/R2

- **Ayo = sumber kebenaran** booking/transaksi; **tidak diduplikasi** ke D1.
  Ambil on-demand, cache di **Cloudflare Cache API (edge, gratis)**.
- **D1 hanya data internal** (staff, jadwal, absen, prestasi, socmed, catatan).
- **R2 hanya file**; file utama di **Telegram**. Laporan berat → **Google Sheets**.
- **LLM seminimal mungkin** (penjadwalan utama deterministik).

## Aturan wajib

1. **TIDAK ADA rahasia di Git.** Semua key/token via `wrangler secret put`.
   `.dev.vars` sudah di-`.gitignore`. Jangan commit `.dev.vars`/`.wrangler`.
2. Jangan taruh model/identitas AI di artefak repo (commit/komentar).
3. Jaga **zero-dependency** runtime bila memungkinkan.
4. Grafik: ikuti skill `dataviz` — di hub ini pakai **satu seri** (lolos CVD);
   aksen divisi dipakai sebagai identitas + selalu ada label/ikon.
5. Setelah ubah skema → tambah **migration baru** (jangan edit yang lama).

## Lihat juga

`docs/NOTES.md` — keputusan desain, asumsi, dan **TODO** (termasuk **CATATAN
mobile token AVM** yang menunggu contoh dari user).
