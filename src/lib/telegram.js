// Telegram sebagai storage berkas.
//
// Bot mengirim file ke sebuah channel/chat privat (sendDocument). Telegram
// menyimpan file; kita simpan file_id + message_id di D1. Unduh lewat getFile.
// Token & chat id dari secret (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) — tak pernah di Git.
//
// Batas bot API: ~50 MB per file.

export function telegramConfigured(env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

// Basis API bisa diganti (mis. server Bot API self-hosted) lewat TELEGRAM_API_BASE.
const base = (env) => (env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const api = (env, method) => `${base(env)}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function sendDocument(env, name, bytes, contentType = 'application/octet-stream') {
  if (!telegramConfigured(env)) throw new Error('Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
  const fd = new FormData();
  fd.append('chat_id', env.TELEGRAM_CHAT_ID);
  fd.append('caption', name);
  fd.append('document', new Blob([bytes], { type: contentType }), name);
  const res = await fetch(api(env, 'sendDocument'), { method: 'POST', body: fd });
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram sendDocument: ${j.description || res.status}`);
  const doc = j.result.document || {};
  return { file_id: doc.file_id, message_id: j.result.message_id, size: doc.file_size || 0 };
}

// URL unduh langsung (berisi token!) — HANYA dipakai di server, jangan bocor ke klien.
export async function getFileLink(env, fileId) {
  const res = await fetch(`${api(env, 'getFile')}?file_id=${encodeURIComponent(fileId)}`);
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram getFile: ${j.description || res.status}`);
  return `${base(env)}/file/bot${env.TELEGRAM_BOT_TOKEN}/${j.result.file_path}`;
}

export async function deleteMessage(env, messageId) {
  if (!messageId) return;
  await fetch(api(env, 'deleteMessage'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, message_id: messageId }),
  }).catch(() => {});
}
