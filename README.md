# FiftyNineHub

Sistem manajemen venue di **Cloudflare Workers + D1 + R2**, dibangun untuk
sinkron dengan **Ayo Indonesia** dan **Google Workspace**, dengan biaya
seminimal mungkin.

> Status: **fondasi (v0) yang berjalan** di `wrangler dev`. Integrasi Ayo,
> Google, dan LLM sudah ada kerangkanya; endpoint/kredensial diisi & disempurnakan
> saat pengembangan lokal (Claude Code).

## Halaman

Dashboard · **Kasir** · **Finance** · **Social Media** · **Event** ·
**Member** · **Penjadwalan** · **HRD** · **Prestasi & Riwayat Absen** ·
**Master Admin** — dengan login dan hak akses per peran
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
