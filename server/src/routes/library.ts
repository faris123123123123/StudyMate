import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { crud } from '../crud.js';
import { env } from '../config.js';
import { HttpError, check, wrap } from '../http.js';
import * as S from '../schemas.js';

const OOXML = 'application/vnd.openxmlformats-officedocument';
/** Format file yang didukung (PRD 6.7): ekstensi DAN MIME type harus cocok. */
const ALLOWED: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: [`${OOXML}.wordprocessingml.document`],
  pptx: [`${OOXML}.presentationml.presentation`],
  xlsx: [`${OOXML}.spreadsheetml.sheet`],
  txt: ['text/plain'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 } });
const uuidOrNull = (v: unknown) => (typeof v === 'string' && v && v !== 'null' ? S.uuid.parse(v) : null);

export const materialRoutes = Router();

materialRoutes.post('/', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) throw new HttpError(400, 'Pilih file yang akan diunggah.');
  const name = Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 255);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED[ext]?.includes(f.mimetype)) throw new HttpError(400, 'Format file tidak didukung. Gunakan PDF, DOCX, PPTX, XLSX, TXT, JPG, JPEG, atau PNG.');
  if (f.size <= 0) throw new HttpError(400, 'File kosong.');

  const used = (check(await req.db.from('study_materials').select('file_size').range(0, 9999)) as any[]).reduce((a, r) => a + Number(r.file_size), 0);
  if (used + f.size > env.USER_QUOTA_MB * 1024 * 1024) throw new HttpError(413, `Kuota penyimpanan ${env.USER_QUOTA_MB} MB terlampaui.`);

  const folder_id = uuidOrNull(req.body.folder_id);
  const subject_id = uuidOrNull(req.body.subject_id);
  const id = randomUUID();
  const storage_path = `materials/${req.user.id}/${folder_id ?? 'root'}/${id}.${ext}`;
  const row = check(
    await req.db.from('study_materials')
      .insert({ id, user_id: req.user.id, folder_id, subject_id, file_name: name, storage_path, file_type: ext, mime_type: f.mimetype, file_size: f.size, processing_status: 'uploading' })
      .select().single(),
  ) as any;

  const up = await req.db.storage.from(env.STORAGE_BUCKET).upload(storage_path, f.buffer, { contentType: f.mimetype, upsert: false });
  if (up.error) {
    await req.db.from('study_materials').delete().eq('id', id);
    throw new HttpError(502, 'Upload gagal. File belum tersimpan, silakan coba lagi.');
  }
  const ready = check(await req.db.from('study_materials').update({ processing_status: 'ready' }).eq('id', id).select().single());
  res.status(201).json(ready);
}));

materialRoutes.get('/:id', wrap(async (req, res) => {
  const row = check(await req.db.from('study_materials').select('*').eq('id', req.params.id).maybeSingle()) as any;
  if (!row) throw new HttpError(404, 'File tidak ditemukan.');
  const dl = req.query.download ? { download: row.file_name } : undefined;
  const { data, error } = await req.db.storage.from(env.STORAGE_BUCKET).createSignedUrl(row.storage_path, 120, dl);
  if (error) throw new HttpError(502, 'Tautan file tidak dapat dibuat. Coba lagi.');
  res.json({ ...row, signed_url: data.signedUrl });
}));

materialRoutes.delete('/:id', wrap(async (req, res) => {
  const row = check(await req.db.from('study_materials').select('*').eq('id', req.params.id).maybeSingle()) as any;
  if (!row) throw new HttpError(404, 'File tidak ditemukan.');
  // Hapus objek dulu: bila gagal, baris dipertahankan agar tidak ada objek yatim.
  const rm = await req.db.storage.from(env.STORAGE_BUCKET).remove([row.storage_path]);
  if (rm.error) throw new HttpError(502, 'File gagal dihapus dari penyimpanan. Coba lagi.');
  check(await req.db.from('study_materials').delete().eq('id', row.id).select().maybeSingle());
  res.status(204).end();
}));

// Daftar + rename/pindah (list & update dari CRUD generik)
materialRoutes.use(
  crud({
    table: 'study_materials',
    create: S.materialUpdate,
    methods: ['list', 'update'],
    filters: ['folder_id', 'subject_id', 'processing_status', 'file_type'],
    search: ['file_name'],
    sortable: ['file_name', 'created_at', 'file_size'],
    order: { col: 'created_at' },
  }),
);
