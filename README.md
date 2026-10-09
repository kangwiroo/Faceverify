# FaceVerify

Aplikasi verifikasi wajah berbasis web dengan tema warna **CMYK + pelangi**.
Semua proses (deteksi, pengenalan wajah, dan cek kedipan) berjalan di browser
menggunakan [`@vladmandic/face-api`](https://github.com/vladmandic/face-api).
Tidak ada foto atau data wajah yang dikirim ke server.

## Fitur

- **Wajah referensi**: unggah foto atau ambil langsung dari kamera. Disimpan di `localStorage` browser.
- **Verifikasi langsung**: membandingkan wajah di kamera dengan referensi (rata-rata 5 sampel, jarak Euclidean descriptor 128-dimensi).
- **Cek kedipan (liveness)**: menolak foto statis dengan mendeteksi kedipan mata (Eye Aspect Ratio).
- **Ambang yang bisa diatur**: geser untuk membuat verifikasi lebih ketat atau longgar (bawaan `0.50`).
- Overlay kotak wajah bergradasi pelangi dan titik landmark berwarna cyan / magenta / kuning.

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

## Catatan

Ini cocok untuk demo, absensi sederhana, atau belajar. Untuk keamanan tingkat
tinggi (mis. login bank), verifikasi harus dilakukan di server dan memakai
anti-spoofing yang lebih kuat, karena kode di browser bisa dimanipulasi.
