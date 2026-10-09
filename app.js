'use strict';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const STORAGE_KEY = 'faceverify.reference';

// Warna tinta CMYK + pelangi untuk gambar di kanvas
const CMYK = ['#00aeef', '#ec008c', '#fff200'];
const RAINBOW = ['#ff3b3b', '#ff9f1c', '#fff200', '#2ee66b', '#00aeef', '#5b5bff', '#ec008c'];

// Ambang Eye Aspect Ratio untuk deteksi kedipan
const EAR_CLOSED = 0.21;
const EAR_OPEN = 0.26;
const BLINK_TIMEOUT_MS = 10000;
const SAMPLE_COUNT = 5;

const $ = (id) => document.getElementById(id);
const el = {
  status: $('status'),
  stage: $('stage'),
  video: $('video'),
  overlay: $('overlay'),
  placeholder: $('placeholder'),
  hint: $('hint'),
  btnCamera: $('btnCamera'),
  refCanvas: $('refCanvas'),
  refEmpty: $('refEmpty'),
  refInfo: $('refInfo'),
  fileInput: $('fileInput'),
  lblUpload: $('lblUpload'),
  btnCapture: $('btnCapture'),
  btnClear: $('btnClear'),
  threshold: $('threshold'),
  thrVal: $('thrVal'),
  liveness: $('liveness'),
  btnVerify: $('btnVerify'),
  result: $('result'),
  meterFill: $('meterFill'),
  resultTitle: $('resultTitle'),
  resultDetail: $('resultDetail'),
};

const state = {
  modelsReady: false,
  stream: null,
  rafId: 0,
  paused: false,
  verifying: false,
  reference: null, // Float32Array
  blink: { closed: false, detected: false },
};

const liveOptions = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
const photoOptions = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

/* ---------------- Inisialisasi ---------------- */

async function init() {
  el.threshold.addEventListener('input', () => {
    el.thrVal.textContent = Number(el.threshold.value).toFixed(2);
  });
  el.btnCamera.addEventListener('click', toggleCamera);
  el.fileInput.addEventListener('change', onFileChosen);
  el.btnCapture.addEventListener('click', captureReference);
  el.btnClear.addEventListener('click', clearReference);
  el.btnVerify.addEventListener('click', verify);

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
    setStatus('Model siap', 'ready');
  } catch (err) {
    console.error(err);
    setStatus('Gagal memuat model wajah', 'error');
    return;
  }

  loadStoredReference();
  updateButtons();
}

function setStatus(text, kind) {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
}

function setStage(mode) {
  el.stage.className = `stage ${mode}`;
}

function updateButtons() {
  const ready = state.modelsReady;
  const cam = Boolean(state.stream);
  el.btnCamera.disabled = !ready || state.verifying;
  el.btnCamera.textContent = cam ? 'Matikan kamera' : 'Nyalakan kamera';
  el.fileInput.disabled = !ready || state.verifying;
  el.lblUpload.classList.toggle('disabled', el.fileInput.disabled);
  el.btnCapture.disabled = !ready || !cam || state.verifying;
  el.btnClear.disabled = !state.reference || state.verifying;
  el.btnVerify.disabled = !ready || !cam || !state.reference || state.verifying;
}

/* ---------------- Kamera ---------------- */

async function toggleCamera() {
  if (state.stream) {
    stopCamera();
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false,
    });
  } catch (err) {
    console.error(err);
    el.hint.textContent = 'Tidak bisa mengakses kamera. Pastikan izin kamera diberikan dan halaman dibuka lewat https atau localhost.';
    return;
  }
  el.video.srcObject = state.stream;
  await el.video.play();
  el.overlay.width = el.video.videoWidth;
  el.overlay.height = el.video.videoHeight;
  el.placeholder.hidden = true;
  el.hint.textContent = state.reference
    ? 'Kamera aktif. Tekan “Verifikasi sekarang”.'
    : 'Kamera aktif. Daftarkan wajah referensi dulu.';
  setStage('idle');
  updateButtons();
  loop();
}

function stopCamera() {
  cancelAnimationFrame(state.rafId);
  state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  el.video.srcObject = null;
  clearCanvas(el.overlay);
  el.placeholder.hidden = false;
  el.hint.textContent = 'Kamera dimatikan.';
  setStage('idle');
  updateButtons();
}

async function loop() {
  if (!state.stream) return;
  if (!state.paused && el.video.readyState >= 2) {
    const det = await faceapi.detectSingleFace(el.video, liveOptions()).withFaceLandmarks();
    if (state.stream && !state.paused) {
      drawDetection(el.overlay, det);
      trackBlink(det);
    }
  }
  state.rafId = requestAnimationFrame(loop);
}

/* ---------------- Gambar ---------------- */

function clearCanvas(canvas) {
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function drawDetection(canvas, det, { clear = true } = {}) {
  const ctx = canvas.getContext('2d');
  if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!det) return;

  const { x, y, width, height } = det.detection.box;
  const lw = Math.max(3, canvas.width / 160);

  // Kotak dengan gradasi pelangi
  const grad = ctx.createLinearGradient(x, y, x + width, y + height);
  RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.lineWidth = lw;
  ctx.strokeStyle = grad;
  roundRect(ctx, x, y, width, height, Math.min(width, height) * 0.12);
  ctx.stroke();

  // Titik landmark berwarna C / M / Y
  const r = Math.max(1.5, canvas.width / 300);
  det.landmarks.positions.forEach((p, i) => {
    ctx.fillStyle = CMYK[i % CMYK.length];
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- Deteksi kedipan (liveness) ---------------- */

function eyeAspectRatio(pts) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return (d(pts[1], pts[5]) + d(pts[2], pts[4])) / (2 * d(pts[0], pts[3]));
}

function trackBlink(det) {
  if (!det) return;
  const ear = (eyeAspectRatio(det.landmarks.getLeftEye()) + eyeAspectRatio(det.landmarks.getRightEye())) / 2;
  if (ear < EAR_CLOSED) {
    state.blink.closed = true;
  } else if (ear > EAR_OPEN && state.blink.closed) {
    state.blink.closed = false;
    state.blink.detected = true;
  }
}

function waitForBlink() {
  state.blink = { closed: false, detected: false };
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      if (!state.stream) return resolve(false);
      if (state.blink.detected) return resolve(true);
      if (performance.now() - start > BLINK_TIMEOUT_MS) return resolve(false);
      setTimeout(check, 50);
    };
    check();
  });
}

/* ---------------- Wajah referensi ---------------- */

async function onFileChosen(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  await setReferenceFrom(img, photoOptions());
  URL.revokeObjectURL(img.src);
}

async function captureReference() {
  const snap = document.createElement('canvas');
  snap.width = el.video.videoWidth;
  snap.height = el.video.videoHeight;
  const ctx = snap.getContext('2d');
  // Simpan dalam orientasi cermin agar sama dengan yang terlihat
  ctx.translate(snap.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(el.video, 0, 0);
  await setReferenceFrom(snap, photoOptions());
}

async function setReferenceFrom(source, options) {
  el.refInfo.textContent = 'Menganalisis wajah…';
  let dets = await detectAll(source, options);
  if (dets.length === 0) {
    // Foto close-up sering gagal terdeteksi; beri bingkai kosong lalu coba lagi
    source = padImage(source);
    dets = await detectAll(source, options);
    if (dets.length === 0) dets = await detectAll(source, liveOptions());
  }

  if (dets.length === 0) {
    el.refInfo.textContent = 'Wajah tidak ditemukan. Coba foto yang lebih jelas dan terang.';
    return;
  }
  if (dets.length > 1) {
    el.refInfo.textContent = `Terdeteksi ${dets.length} wajah. Gunakan foto dengan satu wajah saja.`;
    return;
  }

  const det = dets[0];
  const thumb = drawReference(source, det);
  state.reference = det.descriptor;
  saveReference(det.descriptor, thumb);
  el.refInfo.textContent = 'Wajah referensi tersimpan ✓';
  if (state.stream) el.hint.textContent = 'Siap. Tekan “Verifikasi sekarang”.';
  hideResult();
  updateButtons();
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

// Potong area wajah ke kanvas referensi, kembalikan dataURL kecil untuk disimpan
function drawReference(source, det) {
  const c = el.refCanvas;
  const ctx = c.getContext('2d');
  const { x, y, width, height } = det.detection.box;
  const size = Math.max(width, height) * 1.6;
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.fillStyle = '#0c0c10';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, cx - size / 2, cy - size / 2, size, size, 0, 0, c.width, c.height);

  // Gambar ulang landmark pada koordinat kanvas referensi
  const scale = c.width / size;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  const r = 2;
  det.landmarks.positions.forEach((p, i) => {
    ctx.fillStyle = CMYK[i % CMYK.length];
    ctx.beginPath();
    ctx.arc((p.x - ox) * scale, (p.y - oy) * scale, r, 0, Math.PI * 2);
    ctx.fill();
  });

  el.refEmpty.hidden = true;
  return c.toDataURL('image/jpeg', 0.8);
}

function clearReference() {
  state.reference = null;
  clearCanvas(el.refCanvas);
  el.refEmpty.hidden = false;
  el.refInfo.textContent = 'Unggah foto atau ambil dari kamera.';
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* abaikan */ }
  hideResult();
  updateButtons();
}

function saveReference(descriptor, thumb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ descriptor: Array.from(descriptor), thumb }));
  } catch { /* penyimpanan tidak tersedia, tetap jalan tanpa menyimpan */ }
}

async function loadStoredReference() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return; }
  if (!saved || !Array.isArray(saved.descriptor) || saved.descriptor.length !== 128) return;
  state.reference = new Float32Array(saved.descriptor);
  if (saved.thumb) {
    const img = await loadImage(saved.thumb);
    el.refCanvas.getContext('2d').drawImage(img, 0, 0, el.refCanvas.width, el.refCanvas.height);
  }
  el.refEmpty.hidden = true;
  el.refInfo.textContent = 'Wajah referensi dimuat dari sesi sebelumnya ✓';
  updateButtons();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ---------------- Verifikasi ---------------- */

async function verify() {
  state.verifying = true;
  updateButtons();
  hideResult();
  setStage('scanning');

  try {
    if (el.liveness.checked) {
      el.hint.textContent = '👁️ Kedipkan mata kamu…';
      const blinked = await waitForBlink();
      if (!blinked) {
        showResult({ ok: false, title: 'Kedipan tidak terdeteksi', detail: 'Pastikan wajah terlihat jelas lalu kedipkan mata dengan perlahan.', score: 0 });
        return;
      }
    }

    el.hint.textContent = 'Memindai wajah… tahan posisi';
    state.paused = true;
    const distances = [];
    for (let i = 0; i < SAMPLE_COUNT * 3 && distances.length < SAMPLE_COUNT && state.stream; i++) {
      const det = await faceapi.detectSingleFace(el.video, liveOptions()).withFaceLandmarks().withFaceDescriptor();
      if (det) {
        drawDetection(el.overlay, det);
        distances.push(faceapi.euclideanDistance(state.reference, det.descriptor));
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (distances.length < 2) {
      showResult({ ok: false, title: 'Wajah tidak terdeteksi', detail: 'Hadapkan wajah ke kamera dengan pencahayaan yang cukup.', score: 0 });
      return;
    }

    const distance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const threshold = Number(el.threshold.value);
    const ok = distance < threshold;
    const score = Math.max(0, Math.min(1, 1 - distance));
    showResult({
      ok,
      title: ok ? '✓ Wajah cocok' : '✗ Wajah tidak cocok',
      detail: `Kemiripan ${(score * 100).toFixed(0)}% · jarak ${distance.toFixed(3)} (ambang ${threshold.toFixed(2)}) · ${distances.length} sampel`,
      score,
    });
  } finally {
    state.paused = false;
    state.verifying = false;
    updateButtons();
  }
}

function showResult({ ok, title, detail, score }) {
  setStage(ok ? 'success' : 'fail');
  el.hint.textContent = ok ? 'Verifikasi berhasil.' : 'Verifikasi gagal. Coba lagi.';
  el.result.hidden = false;
  el.resultTitle.textContent = title;
  el.resultTitle.className = `result-title ${ok ? 'ok' : 'bad'}`;
  el.resultDetail.textContent = detail;
  el.meterFill.style.width = '0';
  requestAnimationFrame(() => { el.meterFill.style.width = `${(score * 100).toFixed(0)}%`; });
}

function hideResult() {
  el.result.hidden = true;
  if (state.stream && !state.verifying) setStage('idle');
}

document.addEventListener('DOMContentLoaded', init);
