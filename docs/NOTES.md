# NOTES — FiftyNineHub

Catatan keputusan, asumsi, dan TODO. Dipakai Claude Code (lokal) untuk paham
konteks tanpa mengulang diskusi. Urut dari yang paling penting.

---

## ⚠️ PENTING — Mobile token AVM (menunggu contoh dari user)

AVM (Ayo Venue Management) butuh **mobile token** untuk melakukan aktivitas.
Token ini bisa dibaca **ketika user sudah login ke situs AVM**.
**Contoh mobile token akan diberikan user menyusul.**

Yang sudah ada sekarang:
- Kolom `users.ayo_mobile_token` (dan `users.ayo_account`) — diisi dari halaman **HRD**.
- Sistem baru **menyimpan** token; **belum memakainya** untuk aksi ke AVM.

Tugas lokal (setelah contoh token ada):
1. Tentukan cara **membaca/menyegarkan** mobile token dari sesi AVM (format &
   sumbernya lihat contoh yang akan diberikan).
2. Simpan per-user di `users.ayo_mobile_token` (atau secret store bila lebih aman).
3. Saat melakukan aksi ke AVM, **tempelkan token** pada request/link aksi.
   (Awalnya user menyebut "token+lokasi di link saat action" → diklarifikasi:
   maksudnya **token AVM** diteruskan saat aksi, bukan GPS.)
4. Tambahkan refresh/expiry handling bila token punya masa berlaku.

---

## Keputusan desain (sudah final)

- **Login PIN 8 digit saja** (tanpa email). Dipilih user. Trade-off: entropi
  rendah → butuh pengamanan (lihat TODO keamanan).
- **Storage berkas = Telegram** (bot → channel privat), bukan R2. Simpan **5
  versi** terakhir (rollback 5 tahap), versi lebih tua dihapus (pesan Telegram
  ikut terhapus). Unduh di-proxy lewat Worker (`/dl/:versionId`) agar token bot
  tidak bocor. Unggah nama sama = versi baru.
- **Ayo = sumber kebenaran**; tidak diduplikasi ke D1; cache di edge.
- **Jadwal Booking** = halaman tersendiri berisi **iframe** Ayo (`AYO_EMBED_URL`).
- **LLM (Nemotron) dipakai minimal**; penjadwalan utama deterministik
  (round-robin). Key round-robin + failover, 20 aktif dari pool.
- **Laporan/transaksi berat → Google Sheets/Docs** agar D1 ramping.
- UI: design system dengan **aksen per divisi** (validasi colorblind lewat skill
  `dataviz`), **tema gelap/terang manual**, responsif (drawer di mobile).

## Asumsi yang diambil (konfirmasi bila perlu)

- Socmed "bind" = registry akun terhubung per platform (handle + status);
  **OAuth/token asli belum** — disimpan sebagai secret saat disempurnakan.
- PIN unik lintas akun (dibutuhkan karena login tanpa email). Jaga keunikan saat
  set/ubah PIN.
- `AYO_EMBED_URL` = URL halaman Ayo yang boleh di-iframe. Ayo mungkin memblokir
  iframe (X-Frame-Options/CSP) → sediakan URL embed resmi atau fallback tab baru.

## TODO (prioritas)

### Keamanan
- [ ] **Rate-limit + lockout** login PIN (mis. 5 gagal → jeda), dan **pepper**
      per-perangkat/env untuk PIN (lawan brute force 10^8).
- [ ] Audit log untuk aksi penting (tabel `audit_log` sudah ada, belum dipakai).

### Ayo / AVM
- [ ] Isi endpoint Ayo asli di `src/lib/ayo.js` (bookings/transactions/members/venues).
- [ ] Wire **mobile token** ke aksi AVM (lihat bagian PENTING di atas).
- [ ] Tampilkan booking hari ini dari Ayo di halaman **Kasir**.

### Google
- [ ] Simpan ID Sheet/Docs di tabel `settings`; push laporan Finance ke Sheets.

### Fitur
- [ ] Edit data (saat ini: list/tambah/hapus).
- [ ] Cek bentrok jadwal booking (satu venue tidak dobel waktu).
- [ ] Preview gambar/PDF inline di halaman Dokumen.
- [ ] Cron Trigger: tarik ringkasan Ayo harian → Sheets.

## Cara uji cepat tanpa kredensial asli

- **Telegram:** jalankan mock Bot API lokal lalu set `TELEGRAM_API_BASE` ke mock.
  (Sudah dipakai untuk memverifikasi upload→5 versi→rollback→unduh.)
- **PIN:** admin `12345678`. Salah → 401, benar → redirect `/dashboard`.
- Semua halaman harus balas 200 setelah login.

## Jangan lupa

- Tambah **migration baru** untuk perubahan skema (jangan edit 0001..0004).
- Jangan commit `.dev.vars` / `.wrangler` / rahasia apa pun.
- `database_id` di `wrangler.toml` masih `REPLACE_AFTER_D1_CREATE`.
