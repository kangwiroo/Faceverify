// Uji simulator liveness: data wajah sintetis -> kode deteksi asli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sim = require('../sim/liveness-sim.js');
const S = require('../verify-session.js');

test('blinkEarSeries: terdeteksi tepat satu kedipan', () => {
  assert.equal(sim.countBlinks(sim.blinkEarSeries()), 1);
});

test('photoEarSeries: foto diam -> nol kedipan', () => {
  assert.equal(sim.countBlinks(sim.photoEarSeries()), 0);
});

test('EAR saat mata menutup lebih kecil daripada saat terbuka', () => {
  const series = sim.blinkEarSeries();
  assert.ok(Math.min(...series) < 0.21); // sempat di bawah ambang tutup
  assert.ok(Math.max(...series) > 0.26); // dan di atas ambang buka
});

test('liveFlashSamples: wajah hidup lolos ambang pantulan', () => {
  const r = S.scoreChallenge(S.DEFAULT_PALETTE, sim.liveFlashSamples(S.DEFAULT_PALETTE));
  assert.equal(r.orderMatched, true);
  assert.ok(r.score >= 0.15);
});

test('photoFlashSamples: foto diam gagal ambang pantulan', () => {
  const r = S.scoreChallenge(S.DEFAULT_PALETTE, sim.photoFlashSamples(S.DEFAULT_PALETTE));
  assert.ok(r.score < 0.15);
});

test('simulasi utuh: wajah hidup (kedip + pantulan) -> lolos verifikasi', () => {
  const ref = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
  const r = S.verifyAttempt({
    reference: ref,
    descriptors: [ref.map((v) => v + 0.01)],
    blinked: sim.countBlinks(sim.blinkEarSeries()) > 0,
    flashSamples: sim.liveFlashSamples(S.DEFAULT_PALETTE),
    issuedFlashOrder: S.DEFAULT_PALETTE,
  });
  assert.equal(r.ok, true);
});

test('simulasi utuh: foto diam (tanpa kedip) -> ditolak', () => {
  const ref = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
  const r = S.verifyAttempt({
    reference: ref,
    descriptors: [ref.map((v) => v + 0.01)],
    blinked: sim.countBlinks(sim.photoEarSeries()) > 0, // false
    flashSamples: sim.photoFlashSamples(S.DEFAULT_PALETTE),
    issuedFlashOrder: S.DEFAULT_PALETTE,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-blink');
});
