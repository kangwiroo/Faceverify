// Logika dokumen + versioning di atas storage Telegram.
// Simpan maksimal 5 versi (rollback 5 tahap); versi tertua dibuang otomatis.

import { all, first, run } from './db.js';
import { uuid } from './crypto.js';
import * as tg from './telegram.js';

export const MAX_VERSIONS = 5;

// Unggah versi baru (buat dokumen bila documentId kosong).
export async function uploadVersion(env, { documentId, name, category, bytes, contentType, userId }) {
  let docId = documentId;
  if (!docId) {
    // Nama sama = dokumen yang sama → unggahan jadi versi baru (backup versi lama).
    const existing = await first(env, 'SELECT id FROM documents WHERE name = ?', name);
    if (existing) docId = existing.id;
    else {
      docId = uuid();
      await run(env, 'INSERT INTO documents (id, name, category) VALUES (?,?,?)', docId, name, category || 'umum');
    }
  }

  const sent = await tg.sendDocument(env, name, bytes, contentType);

  const prev = await first(env, 'SELECT COALESCE(MAX(version),0) m FROM document_versions WHERE document_id = ?', docId);
  const version = prev.m + 1;

  await run(env, 'UPDATE document_versions SET is_current = 0 WHERE document_id = ?', docId);
  await run(env,
    'INSERT INTO document_versions (id, document_id, version, tg_file_id, tg_message_id, size, content_type, uploaded_by, is_current) VALUES (?,?,?,?,?,?,?,?,1)',
    uuid(), docId, version, sent.file_id, sent.message_id, sent.size, contentType || null, userId || null);
  await run(env, "UPDATE documents SET current_version = ?, updated_at = datetime('now') WHERE id = ?", version, docId);

  // Prune: sisakan 5 versi terbaru, hapus sisanya (pesan Telegram + baris).
  const stale = await all(env,
    'SELECT id, tg_message_id FROM document_versions WHERE document_id = ? ORDER BY version DESC LIMIT -1 OFFSET ?',
    docId, MAX_VERSIONS);
  for (const s of stale) {
    await tg.deleteMessage(env, s.tg_message_id);
    await run(env, 'DELETE FROM document_versions WHERE id = ?', s.id);
  }
  return docId;
}

// Pulihkan (rollback) ke versi tertentu — jadikan versi itu "current".
export async function rollback(env, docId, version) {
  const v = await first(env, 'SELECT id FROM document_versions WHERE document_id = ? AND version = ?', docId, version);
  if (!v) return false;
  await run(env, 'UPDATE document_versions SET is_current = 0 WHERE document_id = ?', docId);
  await run(env, 'UPDATE document_versions SET is_current = 1 WHERE id = ?', v.id);
  await run(env, "UPDATE documents SET current_version = ?, updated_at = datetime('now') WHERE id = ?", version, docId);
  return true;
}

export async function removeDocument(env, docId) {
  const vs = await all(env, 'SELECT tg_message_id FROM document_versions WHERE document_id = ?', docId);
  for (const v of vs) await tg.deleteMessage(env, v.tg_message_id);
  await run(env, 'DELETE FROM document_versions WHERE document_id = ?', docId);
  await run(env, 'DELETE FROM documents WHERE id = ?', docId);
}

export async function listDocuments(env) {
  const docs = await all(env, 'SELECT * FROM documents ORDER BY updated_at DESC');
  for (const d of docs) {
    d.versions = await all(env, 'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version', d.id);
  }
  return docs;
}

// Ambil tautan unduh dari Telegram untuk sebuah versi (dipakai route /dl).
export async function resolveDownload(env, versionId) {
  const v = await first(env,
    'SELECT dv.tg_file_id, dv.content_type, d.name FROM document_versions dv JOIN documents d ON d.id = dv.document_id WHERE dv.id = ?',
    versionId);
  if (!v || !v.tg_file_id) return null;
  const url = await tg.getFileLink(env, v.tg_file_id);
  return { url, name: v.name, type: v.content_type || 'application/octet-stream' };
}
