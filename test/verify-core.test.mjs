// Uji "otak" FaceVerify dengan masukan angka buatan.
// Jalankan: node --test   (tanpa kamera, tanpa data, tanpa internet)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../verify-core.js');

/* ---------- Jarak & descriptor ---------- */

test('euclideanDistance: descriptor identik berjarak 0', () => {
  const a = [1, 2, 3, 4];
  assert.equal(core.euclideanDistance(a, a.slice()), 0);
});

test('euclideanDistance: hitung benar (3-4-5)', () => {
  assert.equal(core.euclideanDistance([0, 0], [3, 4]), 5);
});

test('euclideanDistance: panjang beda -> error', () => {
  assert.throws(() => core.euclideanDistance([1, 2], [1, 2, 3]));
});

test('meanDescriptor: rata-rata per dimensi', () => {
  const m = core.meanDescriptor([[0, 10], [2, 20], [4, 30]]);
  assert.deepEqual(m, [2, 20]);
});

/* ---------- Eye Aspect Ratio & kedipan ---------- */

// 6 titik mata; tinggi mata dikendalikan oleh parameter h.
const eye = (h) => [
  { x: 0, y: 0 }, { x: 1, y: -h }, { x: 2, y: -h },
  { x: 3, y: 0 }, { x: 2, y: h }, { x: 1, y: h },
];

test('eyeAspectRatio: mata terbuka > mata tertutup', () => {
  assert.ok(core.eyeAspectRatio(eye(1.0)) > core.eyeAspectRatio(eye(0.1)));
});

test('makeBlinkDetector: terbuka terus -> tidak ada kedipan', () => {
  const b = core.makeBlinkDetector();
  for (let i = 0; i < 20; i++) b.push(0.32);
  assert.equal(b.count, 0);
});

test('makeBlinkDetector: tutup lalu buka = satu kedipan', () => {
  const b = core.makeBlinkDetector();
  assert.equal(b.push(0.30), false); // terbuka
  assert.equal(b.push(0.15), false); // menutup
  assert.equal(b.push(0.30), true);  // terbuka lagi -> kedipan selesai
  assert.equal(b.count, 1);
});

test('makeBlinkDetector: turun sedikit (di zona histeresis) bukan kedipan', () => {
  const b = core.makeBlinkDetector();
  b.push(0.30);
  b.push(0.23); // di antara 0.21 dan 0.26 -> belum terhitung menutup
  b.push(0.30);
  assert.equal(b.count, 0);
});

test('makeBlinkDetector: dua kedipan terhitung dua', () => {
  const b = core.makeBlinkDetector();
  [0.30, 0.12, 0.30, 0.10, 0.30].forEach((v) => b.push(v));
  assert.equal(b.count, 2);
});

/* ---------- Kilasan warna ---------- */

const CYAN = core.hexToRgb('#00aeef');

test('hexToRgb: kuning = [255,242,0]', () => {
  assert.deepEqual(core.hexToRgb('#fff200'), [255, 242, 0]);
});

test('colorCorrelation: wajah ikut berubah searah warna -> positif tinggi', () => {
  // Wajah memantulkan cyan: naik di biru & hijau, turun di merah.
  const r = core.colorCorrelation(CYAN, [-20, 15, 25]);
  assert.ok(r > 0.8, `korelasi ${r} harusnya tinggi`);
});

test('colorCorrelation: wajah tak berubah (foto statis) -> ~0', () => {
  assert.equal(core.colorCorrelation(CYAN, [0, 0, 0]), 0);
});

test('colorCorrelation: perubahan berlawanan arah -> negatif', () => {
  const r = core.colorCorrelation(CYAN, [25, -15, -25]);
  assert.ok(r < -0.8, `korelasi ${r} harusnya negatif`);
});

test('flashScore: wajah hidup lolos, foto statis gagal (ambang 0.15)', () => {
  const colors = ['#00aeef', '#ec008c', '#fff200'].map(core.hexToRgb);
  // Wajah hidup: delta searah warna layar.
  const live = colors.map((c) => ({ color: c, delta: c.map((v) => (v - 128) * 0.1) }));
  // Foto statis: delta acak kecil tak berkorelasi.
  const still = colors.map((c) => ({ color: c, delta: [1, -1, 0] }));
  assert.ok(core.flashScore(live) >= 0.15);
  assert.ok(core.flashScore(still) < 0.15);
});

/* ---------- Keputusan akhir ---------- */

test('decide: mirip + kedip + pantulan -> lolos', () => {
  const r = core.decide({ distance: 0.35, blinked: true, flash: 0.4, requireFlash: true });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'ok');
});

test('decide: wajah beda -> gagal (no-match)', () => {
  const r = core.decide({ distance: 0.82, blinked: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-match');
});

test('decide: tidak berkedip -> gagal (no-blink) walau wajah mirip', () => {
  const r = core.decide({ distance: 0.20, blinked: false });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-blink');
});

test('decide: pantulan lemah saat diwajibkan -> gagal (weak-flash)', () => {
  const r = core.decide({ distance: 0.30, blinked: true, flash: 0.05, requireFlash: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'weak-flash');
});

test('decide: pantulan lemah tapi tidak diwajibkan -> tetap lolos', () => {
  const r = core.decide({ distance: 0.30, blinked: true, flash: 0.05, requireFlash: false });
  assert.equal(r.ok, true);
});

test('decide: tepat di ambang tidak dianggap cocok (batas ketat)', () => {
  assert.equal(core.decide({ distance: 0.50, threshold: 0.50, blinked: true }).match, false);
  assert.equal(core.decide({ distance: 0.49, threshold: 0.50, blinked: true }).match, true);
});

test('decide: ambang lebih ketat menolak yang tadinya lolos', () => {
  assert.equal(core.decide({ distance: 0.45, threshold: 0.50, blinked: true }).ok, true);
  assert.equal(core.decide({ distance: 0.45, threshold: 0.40, blinked: true }).ok, false);
});

test('decide: similarity = 1 - distance, dibatasi 0..1', () => {
  assert.equal(core.decide({ distance: 0.2, blinked: true }).similarity, 0.8);
  assert.equal(core.decide({ distance: 1.5, blinked: true }).similarity, 0);
});
