# FaceVerify

Aplikasi verifikasi wajah berbasis web dengan tema warna **CMYK + pelangi**.
Semua proses (deteksi, pengenalan wajah, dan cek kedipan) berjalan di browser
menggunakan [`@vladmandic/face-api`](https://github.com/vladmandic/face-api).
Tidak ada foto atau data wajah yang dikirim ke server.

## Alur

Tampilan mobile-first, layar per layar:

1. **Beranda**: daftarkan wajah referensi lewat swafoto atau unggah foto (disimpan di `localStorage`).
2. **Ambil Swafoto**: kamera dengan panduan **oval wajah**. Petunjuk di label atas oval
   ("Dekatkan wajah", "Posisikan wajah di tengah oval", "Tetap diam") dan garis progres pelangi di oval.
3. **Kedipan**: minta pengguna berkedip (Eye Aspect Ratio) untuk menolak foto statis. Bisa dimatikan.
4. **Kilasan warna**: layar berkedip penuh dengan warna CMYK + pelangi. Pantulan warna di wajah
   diukur sebagai sinyal tambahan wajah asli (eksperimental, bisa diwajibkan di Pengaturan).
5. **Memproses**, lalu **Hasil**: "Verifikasi Wajah Berhasil/Gagal", persentase kemiripan,
   progres "Langkah x dari y", dan kembali otomatis ke beranda.

Pencocokan memakai rata-rata jarak Euclidean descriptor 128-dimensi dari 6 frame stabil.
Ambang bawaan `0.50` (bisa diatur di Pengaturan).

## Menjalankan

Kamera hanya bisa diakses lewat `https://` atau `localhost`.

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

Atau publikasikan folder ini ke GitHub Pages / Netlify / Vercel (semuanya https).

## Struktur

| File         | Isi                                              |
| ------------ | ------------------------------------------------ |
| `index.html` | Tata letak halaman                               |
| `style.css`  | Tema CMYK + pelangi, mode terang/gelap otomatis  |
| `app.js`     | Kamera, deteksi wajah, cek kedipan, verifikasi   |
| `verify-core.js`    | Logika inti murni (jarak, kedipan, warna, keputusan) |
| `verify-session.js` | Tantangan acak & sesi (dipakai server)         |
| `api.js`            | Klien untuk mode server (opsional)             |
| `server/server.js`  | Server verifikasi tanpa dependensi             |
| `test/`             | Uji otomatis (`node --test`)                   |

## Mode server (keputusan di server)

Secara bawaan semua proses di browser (mode lokal, bisa jadi situs statis).
Untuk verifikasi yang lebih sulit dibobol, nyalakan server:

```bash
node server/server.js        # jalan di http://localhost:8787
```

Lalu arahkan browser ke server itu (di konsol halaman, atau sebelum skrip):

```js
localStorage.setItem('faceverify.server', 'http://localhost:8787');
```

Yang berubah di mode server:

- **Referensi wajah disimpan di server**, tidak pernah dikirim balik ke browser.
- **Urutan warna kilasan diacak server tiap sesi** dan diperiksa saat verifikasi,
  sehingga rekaman lama (replay) dengan urutan berbeda ditolak (`reason: replay`).
- **Kedipan diwajibkan server** (tidak bisa dimatikan dari sisi klien), ada
  **kedaluwarsa sesi** dan **batas 3 percobaan** per sesi.

Logika sesi ada di `verify-session.js` dan dipakai ulang oleh `server/server.js`.

> **Batas yang masih ada:** ekstraksi descriptor wajah tetap di browser (pakai
> face-api), jadi penyerang teknis masih bisa mengirim descriptor palsu.
> Penguatan berikutnya: pindahkan deteksi & ekstraksi wajah ke server.

## Pengujian (tanpa kamera)

Logika keputusan dipisah ke `verify-core.js` sebagai fungsi murni, jadi bisa
diuji tanpa kamera, tanpa dataset, dan tanpa internet:

```bash
node --test
```

Uji ini memeriksa dengan angka buatan: jarak descriptor, deteksi kedipan (EAR
dengan histeresis), skor pantulan warna, dan keputusan akhir (`decide`) termasuk
kasus wajah beda, tidak berkedip, dan pantulan warna lemah.

### Simulator liveness (`sim.html`)

Untuk melihat deteksi kedipan dan kilasan warna bekerja tanpa kamera, buka
`sim.html`. Ia menganimasikan **wajah mesh sintetis** (bukan foto siapa pun):
mata menutup lalu membuka untuk menguji deteksi kedipan, dan latar berkedip
warna CMYK/pelangi untuk menguji cek pantulan. Semua dialirkan ke kode deteksi
yang sama dengan aplikasi (`verify-core.js` / `verify-session.js`).

- Mode **Wajah hidup** → kedipan terdeteksi, pantulan tinggi → **Lolos**.
- Mode **Foto diam** → tanpa kedipan, pantulan ~0 → **Ditolak**.

Ini menguji jalur kedipan/warna/keputusan, bukan merender wajah realistis.

Versi 3D ada di `sim3d.html` (Three.js): kepala abstrak yang berputar, berkedip,
dan tersinari warna kilasan — tetap memakai kode deteksi yang sama.

> Yang belum bisa diuji tanpa perangkat: **wajah asli lolos liveness** di depan
> kamera sungguhan. Itu satu-satunya bagian yang butuh kamera, dan dilakukan
> paling akhir. Untuk mengukur ketahanan terhadap wajah palsu, gunakan dataset
> anti-spoofing yang dikumpulkan dengan izin (mis. CelebA-Spoof) — jangan membuat
> wajah tiruan dari foto orang.

## Catatan

Ini cocok untuk demo, absensi sederhana, atau belajar. Untuk keamanan tingkat
tinggi (mis. login bank), verifikasi harus dilakukan di server dan memakai
anti-spoofing yang lebih kuat, karena kode di browser bisa dimanipulasi.
