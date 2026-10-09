'use strict';

/*
 * liveness-sim.js — pembangkit data wajah sintetis untuk menguji liveness.
 *
 * TIDAK membuat wajah realistis dari foto siapa pun. Ini menghasilkan deret
 * angka (lintasan EAR mata & perubahan warna kulit) yang dialirkan ke kode
 * deteksi asli (verify-core.js), sehingga deteksi kedipan dan cek kilasan
 * warna bisa diuji dan divisualkan tanpa kamera.
 */

(function (root, factory) {
  const core = (typeof require === 'function') ? require('../verify-core.js') : root.VerifyCore;
  const api = factory(core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LivenessSim = api;
})(typeof self !== 'undefined' ? self : this, function (core) {

  // Enam titik mata dengan tinggi kelopak `h` (0 = tertutup, besar = terbuka).
  // Tata letaknya meniru indeks mata pada 68-landmark face-api.
  function eyePoints(cx, cy, w, h) {
    const hx = w / 2;
    return [
      { x: cx - hx, y: cy },           // 0 sudut luar
      { x: cx - hx / 2, y: cy - h },   // 1 atas-luar
      { x: cx + hx / 2, y: cy - h },   // 2 atas-dalam
      { x: cx + hx, y: cy },           // 3 sudut dalam
      { x: cx + hx / 2, y: cy + h },   // 4 bawah-dalam
      { x: cx - hx / 2, y: cy + h },   // 5 bawah-luar
    ];
  }

  // Tinggi kelopak mata di frame ke-i: terbuka, lalu satu kedipan di sekitar
  // `blinkAt`, lalu terbuka lagi. openH/closedH mengatur amplitudo.
  function lidHeight(i, { blinkAt = 10, dur = 4, openH = 6, closedH = 0.6 } = {}) {
    const d = Math.abs(i - blinkAt);
    if (d > dur) return openH;
    const t = d / dur;                 // 0 di tengah kedipan, 1 di tepi
    return closedH + (openH - closedH) * t;
  }

  // Deret EAR satu kedipan (mata menutup lalu membuka).
  function blinkEarSeries(frames = 20, opts = {}) {
    return Array.from({ length: frames }, (_, i) =>
      core.eyeAspectRatio(eyePoints(0, 0, 10, lidHeight(i, opts))));
  }

  // Deret EAR foto diam (mata terbuka terus, tanpa kedipan).
  function photoEarSeries(frames = 20, openH = 6) {
    const ear = core.eyeAspectRatio(eyePoints(0, 0, 10, openH));
    return Array(frames).fill(ear);
  }

  // Sampel kilasan untuk WAJAH HIDUP: kulit memantulkan warna layar, jadi
  // perubahan warna (delta) searah dengan warna yang ditampilkan.
  function liveFlashSamples(order, { reflectance = 0.12, hexToRgb = core.hexToRgb } = {}) {
    return order.map((hex) => {
      const c = hexToRgb(hex);
      return { color: c, delta: c.map((v) => (v - 128) * reflectance) };
    });
  }

  // Sampel kilasan untuk FOTO DIAM: nyaris tidak ada perubahan warna.
  function photoFlashSamples(order, { noise = 1, hexToRgb = core.hexToRgb } = {}) {
    return order.map((hex) => ({ color: hexToRgb(hex), delta: [noise, -noise, 0] }));
  }

  // Jalankan deret EAR melalui detektor kedipan asli; kembalikan jumlah kedipan.
  function countBlinks(earSeries, opts) {
    const det = core.makeBlinkDetector(opts);
    earSeries.forEach((ear) => det.push(ear));
    return det.count;
  }

  return {
    eyePoints,
    lidHeight,
    blinkEarSeries,
    photoEarSeries,
    liveFlashSamples,
    photoFlashSamples,
    countBlinks,
  };
});
