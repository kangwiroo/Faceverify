'use strict';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const STORAGE_KEY = 'faceverify.reference';

// Warna tinta CMYK + pelangi
const CMYK = ['#00aeef', '#ec008c', '#fff200'];
// Urutan kedip warna layar untuk cek pantulan cahaya di wajah
const FLASH_COLORS = ['#00aeef', '#ec008c', '#fff200', '#ff3b3b', '#2ee66b', '#5b5bff'];
const FLASH_MS = 380;       // lama tiap warna
const FLASH_SETTLE_MS = 250; // jeda sebelum ambil sampel (latensi kamera)

// Oval panduan wajah, dalam koordinat ternormalisasi area kamera
const OVAL = { cx: 0.5, cy: 0.46, rx: 0.34, ry: 0.35 };

const HOLD_FRAMES = 6;          // jumlah frame stabil di dalam oval sebelum lanjut
const STEP_TIMEOUT_MS = 25000;  // batas waktu memposisikan wajah
const BLINK_TIMEOUT_MS = 10000;
const EAR_CLOSED = 0.21;
const EAR_OPEN = 0.26;
const RESULT_COUNTDOWN_S = 10;

const $ = (id) => document.getElementById(id);
const el = {
  status: $('status'),
  refCanvas: $('refCanvas'),
  refEmpty: $('refEmpty'),
  refInfo: $('refInfo'),
  btnEnroll: $('btnEnroll'),
  lblUpload: $('lblUpload'),
  fileInput: $('fileInput'),
  btnClear: $('btnClear'),
  btnVerify: $('btnVerify'),
  threshold: $('threshold'),
  thrVal: $('thrVal'),
  optBlink: $('optBlink'),
  optFlash: $('optFlash'),

  capture: $('screen-capture'),
  btnClose: $('btnClose'),
  stage: $('stage'),
  mask: $('mask'),
  video: $('video'),
  overlay: $('overlay'),
  pill: $('pill'),
  ringProgress: $('ringProgress'),
  captureSteps: $('captureSteps'),

  resultIcon: $('resultIcon'),
  resultTitle: $('resultTitle'),
  resultDetail: $('resultDetail'),
  resultScore: $('resultScore'),
  scoreVal: $('scoreVal'),
  meterFill: $('meterFill'),
  scoreMeta: $('scoreMeta'),
  stepLabel: $('stepLabel'),
  stepPct: $('stepPct'),
  stepper: $('stepper'),
  countdown: $('countdown'),
  btnRetry: $('btnRetry'),
  btnHome: $('btnHome'),
  toast: $('toast'),
};

const state = {
  modelsReady: false,
  reference: null, // Float32Array
  stream: null,
  session: null,   // sesi swafoto yang sedang berjalan
  countdownId: 0,
  lastMode: 'verify',
};

class Cancelled extends Error {}
class FlowError extends Error {
  constructor(title, detail, step) {
    super(title);
    this.detail = detail;
    this.step = step;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const liveOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
const photoOptions = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

/* ================= Inisialisasi ================= */

async function init() {
  el.threshold.addEventListener('input', () => { el.thrVal.textContent = Number(el.threshold.value).toFixed(2); });
  el.btnEnroll.addEventListener('click', () => runCapture('enroll'));
  el.btnVerify.addEventListener('click', () => runCapture('verify'));
  el.fileInput.addEventListener('change', onFileChosen);
  el.btnClear.addEventListener('click', clearReference);
  el.btnClose.addEventListener('click', () => { cancelSession(); showScreen('home'); });
  el.btnRetry.addEventListener('click', () => runCapture(state.lastMode));
  el.btnHome.addEventListener('click', () => showScreen('home'));

  new ResizeObserver(layoutMask).observe(el.stage);

  if (typeof faceapi === 'undefined') {
    setStatus('Gagal memuat face-api. Cek koneksi internet.', 'error');
    return;
  }

  try {
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    state.modelsReady = true;
    setStatus('Siap digunakan', 'ready');
  } catch (err) {
    console.error(err);
    setStatus('Gagal memuat model wajah', 'error');
    return;
  }

  await loadStoredReference();
  updateHome();
}

function setStatus(text, kind) {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
}

function updateHome() {
  const ready = state.modelsReady;
  el.btnEnroll.disabled = !ready;
  el.fileInput.disabled = !ready;
  el.lblUpload.classList.toggle('disabled', !ready);
  el.btnVerify.disabled = !ready || !state.reference;
  el.btnClear.hidden = !state.reference;
  el.refEmpty.toggleAttribute('hidden', Boolean(state.reference)); // SVG tidak punya properti .hidden
  if (!state.reference) el.refInfo.textContent = 'Belum ada wajah terdaftar. Ambil swafoto atau unggah foto.';
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name !== 'result') clearInterval(state.countdownId);
  if (name !== 'capture') stopCamera();
  window.scrollTo(0, 0);
}

function toast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toast.id);
  toast.id = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

/* ================= Kamera ================= */

async function startCamera() {
  if (state.stream) return;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
      audio: false,
    });
  } catch (err) {
    console.error(err);
    throw new FlowError('Kamera tidak bisa diakses',
      'Izinkan akses kamera, lalu pastikan halaman dibuka lewat https atau localhost.', 0);
  }
  el.video.srcObject = state.stream;
  await el.video.play();
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  el.video.srcObject = null;
}

/* ================= Alur swafoto ================= */

function cancelSession() {
  if (state.session) state.session.cancelled = true;
  state.session = null;
  setFlash(null);
}

function check(session) {
  if (session.cancelled || state.session !== session) throw new Cancelled();
}

function stepsFor(mode) {
  if (mode === 'enroll') return ['Posisi wajah'];
  const steps = ['Posisi wajah'];
  if (el.optBlink.checked) steps.push('Kedipan');
  steps.push('Kilasan warna', 'Pencocokan');
  return steps;
}

function renderMiniSteps(steps, current) {
  el.captureSteps.innerHTML = '';
  steps.forEach((label, i) => {
    const li = document.createElement('li');
    li.textContent = label;
    if (i < current) li.className = 'done';
    if (i === current) li.className = 'current';
    el.captureSteps.appendChild(li);
  });
}

async function runCapture(mode) {
  cancelSession();
  const session = { cancelled: false };
  state.session = session;
  state.lastMode = mode;

  const steps = stepsFor(mode);
  let step = 0;
  const go = (i) => { step = i; renderMiniSteps(steps, i); };

  showScreen('capture');
  go(0);
  setPill('Menyalakan kamera…');
  setProgress(0);
  clearCanvas(el.overlay);

  try {
    await startCamera();
    check(session);

    // 1. Posisikan wajah di oval dan tahan
    const hold = await alignAndHold(session, mode === 'enroll' ? 1 : 0.5);

    if (mode === 'enroll') {
      saveEnrollment(hold);
      showScreen('home');
      toast('Wajah referensi tersimpan ✓');
      return;
    }

    // 2. Kedipan
    if (el.optBlink.checked) {
      go(step + 1);
      await waitForBlink(session);
      setProgress(0.7);
    }

    // 3. Kilasan warna layar
    go(step + 1);
    const flash = await runFlash(session, hold.box);
    check(session);

    // 4. Pencocokan
    go(step + 1);
    stopCamera();
    showScreen('process');
    await sleep(1200);
    check(session);

    const distances = hold.descriptors.map((d) => faceapi.euclideanDistance(state.reference, d));
    const distance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const threshold = Number(el.threshold.value);
    const similarity = Math.max(0, Math.min(1, 1 - distance));
    const flashOk = !el.optFlash.checked || flash.score >= 0.15;
    const match = distance < threshold;
    const ok = match && flashOk;

    let detail;
    if (ok) detail = 'Wajah kamu cocok dengan wajah referensi.';
    else if (!match) detail = 'Wajah tidak cocok dengan wajah referensi. Pastikan pencahayaan cukup dan wajah menghadap lurus.';
    else detail = 'Pantulan warna layar di wajah terlalu lemah. Naikkan kecerahan layar dan coba lagi.';

    showResult({
      ok,
      title: ok ? 'Verifikasi Wajah Berhasil' : 'Verifikasi Wajah Gagal',
      detail,
      similarity,
      meta: `Jarak ${distance.toFixed(3)} (ambang ${threshold.toFixed(2)}) · pantulan warna ${flash.score.toFixed(2)}`,
      steps,
      reached: ok ? steps.length : steps.length - 1,
      failed: !ok,
    });
  } catch (err) {
    setFlash(null);
    if (err instanceof Cancelled) return;
    stopCamera();
    if (state.session !== session) return;
    if (!(err instanceof FlowError)) console.error(err);
    showResult({
      ok: false,
      title: err instanceof FlowError ? err.message : 'Terjadi kesalahan',
      detail: err instanceof FlowError ? err.detail : 'Silakan coba lagi.',
      steps,
      reached: step,
      failed: true,
    });
  } finally {
    if (state.session === session) state.session = null;
  }
}

// Gambar ulang oval dalam satuan piksel agar garis tidak terdistorsi dan progres akurat
function layoutMask() {
  const W = el.stage.clientWidth;
  const H = el.stage.clientHeight;
  if (!W || !H) return;
  const cx = W * OVAL.cx;
  const cy = H * OVAL.cy;
  const rx = W * OVAL.rx;
  const ry = H * OVAL.ry;
  const set = (node, attrs) => Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  el.mask.setAttribute('viewBox', `0 0 ${W} ${H}`);
  set($('maskOut'), { d: `M0 0H${W}V${H}H0Z M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z` });
  set($('maskTint'), { cx, cy, rx, ry });
  set($('ringInner'), { cx, cy, rx, ry });
  set($('ringOuter'), { cx, cy, rx: rx + 9, ry: ry + 9 });
  set(el.ringProgress, { d: `M${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}A${rx} ${ry} 0 0 1 ${cx} ${cy - ry}` });
}

function setPill(text, kind = '') {
  if (el.pill.textContent !== text) el.pill.textContent = text;
  el.pill.className = `pill ${kind}`;
}

function setProgress(p) {
  el.ringProgress.style.strokeDashoffset = String(100 * (1 - Math.max(0, Math.min(1, p))));
}

// Ubah titik (koordinat video) menjadi koordinat ternormalisasi area kamera,
// memperhitungkan object-fit: cover dan efek cermin.
function toStage(pt) {
  const W = el.stage.clientWidth;
  const H = el.stage.clientHeight;
  const vw = el.video.videoWidth;
  const vh = el.video.videoHeight;
  const s = Math.max(W / vw, H / vh);
  const x = (W - vw * s) / 2 + pt.x * s;
  const y = (H - vh * s) / 2 + pt.y * s;
  return { x: (W - x) / W, y: y / H };
}

// Nilai posisi wajah berdasarkan landmark: ujung hidung untuk posisi,
// jarak sudut luar mata untuk ukuran (lebih stabil daripada kotak deteksi).
function assess(dets, prevCenter) {
  if (dets.length === 0) return { ok: false, msg: 'Posisikan wajah di dalam oval' };
  if (dets.length > 1) return { ok: false, msg: 'Pastikan hanya ada satu wajah', kind: 'warn' };
  const pts = dets[0].landmarks.positions;
  const nose = toStage(pts[30]);
  const eyeL = toStage(pts[36]);
  const eyeR = toStage(pts[45]);
  const size = Math.abs(eyeR.x - eyeL.x) / (OVAL.rx * 2);
  const dx = (nose.x - OVAL.cx) / OVAL.rx;
  const dy = (nose.y - OVAL.cy) / OVAL.ry;
  if (size < 0.35) return { ok: false, msg: 'Dekatkan wajah ke kamera', center: nose };
  if (size > 0.8) return { ok: false, msg: 'Jauhkan wajah sedikit', center: nose };
  // Hidung idealnya sedikit di bawah titik tengah oval (oval juga memuat dahi dan rambut)
  if (Math.abs(dx) > 0.35 || dy < -0.2 || dy > 0.55) {
    return { ok: false, msg: 'Posisikan wajah di tengah oval', center: nose };
  }
  if (prevCenter && Math.hypot(nose.x - prevCenter.x, nose.y - prevCenter.y) > 0.03) {
    return { ok: false, msg: 'Tetap diam', kind: 'warn', center: nose };
  }
  return { ok: true, msg: 'Tetap diam', kind: 'good', center: nose };
}

async function alignAndHold(session, progressShare) {
  const start = performance.now();
  const descriptors = [];
  let box = null;
  let prevCenter = null;
  let snapshot = null;

  for (;;) {
    check(session);
    if (performance.now() - start > STEP_TIMEOUT_MS) {
      throw new FlowError('Wajah tidak terdeteksi',
        'Pastikan wajah berada di dalam oval, pencahayaan cukup, dan tidak tertutup masker atau kacamata gelap.', 0);
    }

    const dets = await faceapi.detectAllFaces(el.video, liveOptions()).withFaceLandmarks().withFaceDescriptors();
    check(session);
    drawLandmarks(dets);

    const a = assess(dets, prevCenter);
    prevCenter = a.center || null;
    setPill(a.msg, a.kind);

    if (a.ok) {
      descriptors.push(dets[0].descriptor);
      box = dets[0].detection.box;
      if (descriptors.length === Math.ceil(HOLD_FRAMES / 2)) snapshot = snapshotFace(box);
      setProgress((descriptors.length / HOLD_FRAMES) * progressShare);
      if (descriptors.length >= HOLD_FRAMES) return { descriptors, box, snapshot };
    } else if (descriptors.length) {
      descriptors.length = 0;
      setProgress(0);
    }
    await nextFrame();
  }
}

function eyeAspectRatio(pts) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return (d(pts[1], pts[5]) + d(pts[2], pts[4])) / (2 * d(pts[0], pts[3]));
}

async function waitForBlink(session) {
  const start = performance.now();
  let closed = false;
  setPill('Kedipkan mata kamu', 'warn');

  for (;;) {
    check(session);
    if (performance.now() - start > BLINK_TIMEOUT_MS) {
      throw new FlowError('Kedipan tidak terdeteksi',
        'Pastikan wajah terlihat jelas, lalu kedipkan mata dengan perlahan.', 1);
    }
    const det = await faceapi.detectSingleFace(el.video, liveOptions()).withFaceLandmarks();
    check(session);
    drawLandmarks(det ? [det] : []);
    if (!det) {
      setPill('Wajah tidak terlihat', 'warn');
    } else {
      setPill('Kedipkan mata kamu', 'warn');
      const lm = det.landmarks;
      const ear = (eyeAspectRatio(lm.getLeftEye()) + eyeAspectRatio(lm.getRightEye())) / 2;
      if (ear < EAR_CLOSED) closed = true;
      else if (closed && ear > EAR_OPEN) return;
    }
    await nextFrame();
  }
}

/* ================= Kilasan warna (cek pantulan cahaya) ================= */

const sampler = document.createElement('canvas');
sampler.width = 32;
sampler.height = 32;

function sampleFace(box) {
  const ctx = sampler.getContext('2d', { willReadFrequently: true });
  const inset = 0.22; // ambil bagian tengah wajah saja (pipi, hidung, dahi)
  ctx.drawImage(el.video,
    box.x + box.width * inset, box.y + box.height * inset,
    box.width * (1 - 2 * inset), box.height * (1 - 2 * inset),
    0, 0, sampler.width, sampler.height);
  const d = ctx.getImageData(0, 0, sampler.width, sampler.height).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return [r / n, g / n, b / n];
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Korelasi antara warna yang ditampilkan dan perubahan warna di wajah.
// Wajah asli di depan layar memantulkan warna layar, sehingga skornya positif.
function colorCorrelation(expected, observed) {
  const center = (v) => { const m = (v[0] + v[1] + v[2]) / 3; return v.map((x) => x - m); };
  const e = center(expected);
  const o = center(observed);
  const dot = e[0] * o[0] + e[1] * o[1] + e[2] * o[2];
  const ne = Math.hypot(...e);
  const no = Math.hypot(...o);
  return ne && no > 0.5 ? dot / (ne * no) : 0;
}

function setFlash(color) {
  el.capture.classList.toggle('flashing', Boolean(color));
  if (color) document.documentElement.style.setProperty('--flash', color);
}

async function runFlash(session, box) {
  setPill('Tetap diam', 'good');
  clearCanvas(el.overlay);
  const baseline = sampleFace(box);
  const scores = [];

  try {
    for (let i = 0; i < FLASH_COLORS.length; i++) {
      check(session);
      setFlash(FLASH_COLORS[i]);
      await sleep(FLASH_SETTLE_MS);
      const sample = sampleFace(box);
      const observed = sample.map((v, k) => v - baseline[k]);
      scores.push(colorCorrelation(hexToRgb(FLASH_COLORS[i]), observed));
      setProgress(0.7 + 0.3 * ((i + 1) / FLASH_COLORS.length));
      await sleep(FLASH_MS - FLASH_SETTLE_MS);
    }
  } finally {
    setFlash(null);
  }
  return { score: scores.reduce((a, b) => a + b, 0) / scores.length };
}

/* ================= Gambar ================= */

function clearCanvas(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function drawLandmarks(dets) {
  // Samakan ukuran kanvas dengan resolusi kamera (bisa berubah setelah kamera menyala)
  if (el.overlay.width !== el.video.videoWidth || el.overlay.height !== el.video.videoHeight) {
    el.overlay.width = el.video.videoWidth;
    el.overlay.height = el.video.videoHeight;
  }
  const ctx = el.overlay.getContext('2d');
  ctx.clearRect(0, 0, el.overlay.width, el.overlay.height);
  const r = Math.max(1.5, el.overlay.width / 320);
  dets.forEach((det) => {
    det.landmarks.positions.forEach((p, i) => {
      ctx.fillStyle = CMYK[i % CMYK.length];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

// Potong area wajah dari sumber gambar menjadi kotak persegi (untuk avatar referensi)
function cropFace(source, box, mirror = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 240;
  const ctx = c.getContext('2d');
  const size = Math.max(box.width, box.height) * 1.7;
  const sx = box.x + box.width / 2 - size / 2;
  const sy = box.y + box.height / 2 - size / 2;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, c.width, c.height);
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, sx, sy, size, size, 0, 0, c.width, c.height);
  return c;
}

function snapshotFace(box) {
  return cropFace(el.video, box, true);
}

/* ================= Wajah referensi ================= */

function meanDescriptor(list) {
  const out = new Float32Array(128);
  list.forEach((d) => d.forEach((v, i) => { out[i] += v / list.length; }));
  return out;
}

function setReference(descriptor, thumbCanvas) {
  state.reference = descriptor;
  const ctx = el.refCanvas.getContext('2d');
  ctx.clearRect(0, 0, el.refCanvas.width, el.refCanvas.height);
  ctx.drawImage(thumbCanvas, 0, 0, el.refCanvas.width, el.refCanvas.height);
  el.refInfo.textContent = 'Wajah terdaftar ✓ Siap diverifikasi.';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      descriptor: Array.from(descriptor),
      thumb: el.refCanvas.toDataURL('image/jpeg', 0.8),
    }));
  } catch { /* penyimpanan tidak tersedia, tetap jalan tanpa menyimpan */ }
  updateHome();
}

function saveEnrollment(hold) {
  setReference(meanDescriptor(hold.descriptors), hold.snapshot || snapshotFace(hold.box));
}

async function onFileChosen(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  el.refInfo.textContent = 'Menganalisis foto…';
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let source = img;
    let dets = await detectAll(source, photoOptions());
    if (dets.length === 0) {
      // Foto close-up sering gagal terdeteksi; beri bingkai kosong lalu coba lagi
      source = padImage(img);
      dets = await detectAll(source, photoOptions());
      if (dets.length === 0) dets = await detectAll(source, liveOptions());
    }
    if (dets.length !== 1) {
      el.refInfo.textContent = dets.length
        ? `Terdeteksi ${dets.length} wajah. Gunakan foto dengan satu wajah saja.`
        : 'Wajah tidak ditemukan. Coba foto yang lebih jelas dan terang.';
      if (!state.reference) return;
      toast(el.refInfo.textContent);
      el.refInfo.textContent = 'Wajah terdaftar ✓ Siap diverifikasi.';
      return;
    }
    setReference(dets[0].descriptor, cropFace(source, dets[0].detection.box));
    toast('Wajah referensi tersimpan ✓');
  } catch (err) {
    console.error(err);
    el.refInfo.textContent = 'Foto tidak bisa dibaca.';
  } finally {
    URL.revokeObjectURL(url);
  }
}

function detectAll(source, options) {
  return faceapi.detectAllFaces(source, options).withFaceLandmarks().withFaceDescriptors();
}

function padImage(source) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const pad = Math.round(Math.max(w, h) * 0.5);
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, pad, pad, w, h);
  return c;
}

function clearReference() {
  state.reference = null;
  clearCanvas(el.refCanvas);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* abaikan */ }
  updateHome();
}

async function loadStoredReference() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return; }
  if (!saved || !Array.isArray(saved.descriptor) || saved.descriptor.length !== 128) return;
  state.reference = new Float32Array(saved.descriptor);
  if (saved.thumb) {
    try {
      const img = await loadImage(saved.thumb);
      el.refCanvas.getContext('2d').drawImage(img, 0, 0, el.refCanvas.width, el.refCanvas.height);
    } catch { /* thumbnail rusak, abaikan */ }
  }
  el.refInfo.textContent = 'Wajah terdaftar ✓ Siap diverifikasi.';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ================= Hasil ================= */

const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_BAD = '<svg viewBox="0 0 24 24"><path d="M12 6v8"/><path d="M12 18.5v.01"/></svg>';

function showResult({ ok, title, detail, similarity, meta, steps, reached, failed }) {
  showScreen('result');

  el.resultIcon.className = `result-icon ${ok ? 'ok' : 'bad'}`;
  el.resultIcon.innerHTML = ok ? ICON_OK : ICON_BAD;
  el.resultTitle.textContent = title;
  el.resultTitle.className = `result-title ${ok ? 'ok' : 'bad'}`;
  el.resultDetail.textContent = detail;

  el.resultScore.hidden = similarity === undefined;
  if (similarity !== undefined) {
    const pct = Math.round(similarity * 100);
    el.scoreVal.textContent = `${pct}%`;
    el.scoreMeta.textContent = meta;
    el.meterFill.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { el.meterFill.style.width = `${pct}%`; }));
  }

  // Langkah x dari y
  const total = steps.length;
  const shown = Math.min(total, reached + (failed ? 1 : 0));
  el.stepLabel.textContent = `Langkah ${shown} dari ${total}`;
  el.stepPct.textContent = `${Math.round((reached / total) * 100)}%`;
  el.stepper.innerHTML = '';
  steps.forEach((_, i) => {
    const seg = document.createElement('i');
    if (i < reached) seg.className = 'done';
    else if (failed && i === reached) seg.className = 'fail';
    el.stepper.appendChild(seg);
  });

  // Hitung mundur kembali ke beranda
  let left = RESULT_COUNTDOWN_S;
  const tick = () => { el.countdown.textContent = `Kembali ke halaman utama dalam ${left} detik.`; };
  tick();
  clearInterval(state.countdownId);
  state.countdownId = setInterval(() => {
    left -= 1;
    if (left <= 0) showScreen('home');
    else tick();
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
