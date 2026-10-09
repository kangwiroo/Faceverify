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

## Pengujian (tanpa kamera)

Logika keputusan dipisah ke `verify-core.js` sebagai fungsi murni, jadi bisa
diuji tanpa kamera, tanpa dataset, dan tanpa internet:

```bash
node --test
```

Uji ini memeriksa dengan angka buatan: jarak descriptor, deteksi kedipan (EAR
dengan histeresis), skor pantulan warna, dan keputusan akhir (`decide`) termasuk
kasus wajah beda, tidak berkedip, dan pantulan warna lemah.

> Yang belum bisa diuji tanpa perangkat: **wajah asli lolos liveness** di depan
> kamera sungguhan. Itu satu-satunya bagian yang butuh kamera, dan dilakukan
> paling akhir. Untuk mengukur ketahanan terhadap wajah palsu, gunakan dataset
> anti-spoofing yang dikumpulkan dengan izin (mis. CelebA-Spoof) — jangan membuat
> wajah tiruan dari foto orang.

## Catatan

Ini cocok untuk demo, absensi sederhana, atau belajar. Untuk keamanan tingkat
tinggi (mis. login bank), verifikasi harus dilakukan di server dan memakai
anti-spoofing yang lebih kuat, karena kode di browser bisa dimanipulasi.
