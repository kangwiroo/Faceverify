'use strict';

/*
 * verify-core.js — "otak" FaceVerify sebagai fungsi murni.
 *
 * Tidak menyentuh DOM, kamera, atau face-api, sehingga bisa diuji di Node
 * dengan masukan angka buatan. app.js memakai modul ini di browser,
 * dan test/verify-core.test.mjs mengujinya tanpa kamera.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / uji
  else root.VerifyCore = api;                                                // browser
})(typeof self !== 'undefined' ? self : this, function () {

  // Jarak Euclidean antara dua descriptor wajah (array 128 angka).
  function euclideanDistance(a, b) {
    if (a.length !== b.length) throw new Error('panjang descriptor berbeda');
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  // Rata-rata beberapa descriptor menjadi satu referensi yang lebih stabil.
  function meanDescriptor(list) {
    if (!list.length) throw new Error('daftar descriptor kosong');
    const out = new Array(list[0].length).fill(0);
    for (const d of list) {
      for (let i = 0; i < d.length; i++) out[i] += d[i] / list.length;
    }
    return out;
  }

  // Eye Aspect Ratio (EAR) dari 6 titik mata [p0..p5].
  // Mata terbuka -> rasio besar; mata tertutup -> rasio kecil.
  function eyeAspectRatio(pts) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    return (d(pts[1], pts[5]) + d(pts[2], pts[4])) / (2 * d(pts[0], pts[3]));
  }

  // Deteksi kedipan dengan histeresis: mata harus benar-benar tertutup
  // (di bawah ambang tutup) lalu terbuka lagi (di atas ambang buka).
  // Dibuat sebagai mesin keadaan agar bisa diuji frame per frame.
  function makeBlinkDetector({ closed = 0.21, open = 0.26 } = {}) {
    let wasClosed = false;
    let blinks = 0;
    return {
      // Kembalikan true pada frame saat satu kedipan selesai.
      push(ear) {
        if (ear < closed) {
          wasClosed = true;
        } else if (wasClosed && ear > open) {
          wasClosed = false;
          blinks += 1;
          return true;
        }
        return false;
      },
      get count() { return blinks; },
    };
  }

  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  // Korelasi (cosine) antara warna layar yang ditampilkan dan perubahan
  // warna yang terlihat di wajah. Wajah asli di depan layar memantulkan
  // warna layar -> korelasi positif. Foto/wajah statis -> mendekati nol.
  function colorCorrelation(expected, observed) {
    const center = (v) => { const m = (v[0] + v[1] + v[2]) / 3; return v.map((x) => x - m); };
    const e = center(expected);
    const o = center(observed);
    const dot = e[0] * o[0] + e[1] * o[1] + e[2] * o[2];
    const ne = Math.hypot(...e);
    const no = Math.hypot(...o);
    return ne && no > 0.5 ? dot / (ne * no) : 0;
  }

  // Rata-rata skor korelasi dari serangkaian kilasan warna.
  // samples: [{ color: [r,g,b], delta: [dr,dg,db] }, ...]
  function flashScore(samples) {
    if (!samples.length) return 0;
    const sum = samples.reduce((acc, s) => acc + colorCorrelation(s.color, s.delta), 0);
    return sum / samples.length;
  }

  // Keputusan akhir verifikasi. Semua masukan berupa angka, tanpa efek samping.
  function decide({ distance, threshold = 0.5, blinked = true, requireBlink = true,
                    flash = 0, requireFlash = false, flashMin = 0.15 }) {
    const similarity = Math.max(0, Math.min(1, 1 - distance));
    const match = distance < threshold;
    const blinkOk = !requireBlink || blinked;
    const flashOk = !requireFlash || flash >= flashMin;
    const ok = match && blinkOk && flashOk;

    let reason = 'ok';
    if (!blinkOk) reason = 'no-blink';
    else if (!match) reason = 'no-match';
    else if (!flashOk) reason = 'weak-flash';

    return { ok, match, blinkOk, flashOk, similarity, reason };
  }

  return {
    euclideanDistance,
    meanDescriptor,
    eyeAspectRatio,
    makeBlinkDetector,
    hexToRgb,
    colorCorrelation,
    flashScore,
    decide,
  };
});
