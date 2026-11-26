import { Router } from 'express';
import multer from 'multer';
import { env } from '../config.js';
import { HttpError, check, wrap } from '../http.js';
import * as S from '../schemas.js';
import { admin } from '../supabase.js';
import { cancelPending, resyncUser } from '../services/reminders.js';
import { vapidPublicKey } from '../services/push.js';

const AVATAR_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

async function removePrefix(prefix: string) {
  const bucket = admin.storage.from(env.STORAGE_BUCKET);
  const { data } = await bucket.list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const item of data ?? []) {
    if (item.id) files.push(`${prefix}/${item.name}`);
    else await removePrefix(`${prefix}/${item.name}`);
  }
  if (files.length) await bucket.remove(files);
}

// ---------- /api/profile ----------
export const profileRoutes = Router();

async function loadProfile(req: any) {
  const p = check(await req.db.from('profiles').select('*').eq('id', req.user.id).single()) as any;
  let avatar_signed_url: string | null = null;
  if (p.avatar_url) {
    const { data } = await req.db.storage.from(env.STORAGE_BUCKET).createSignedUrl(p.avatar_url, 3600);
    avatar_signed_url = data?.signedUrl ?? null;
  }
  return { ...p, email: req.user.email, avatar_signed_url };
}

profileRoutes.get('/', wrap(async (req, res) => res.json(await loadProfile(req))));

profileRoutes.put('/', wrap(async (req, res) => {
  const body = S.profile.parse(req.body);
  check(await req.db.from('profiles').update(body).eq('id', req.user.id).select().single());
  res.json(await loadProfile(req));
}));

profileRoutes.post('/avatar', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  const ext = f && AVATAR_MIME[f.mimetype];
  if (!f || !ext) throw new HttpError(400, 'Foto profil harus berupa PNG atau JPG (maks. 2 MB).');
  const path = `avatars/${req.user.id}/avatar-${Date.now()}.${ext}`;
  const up = await req.db.storage.from(env.STORAGE_BUCKET).upload(path, f.buffer, { contentType: f.mimetype });
  if (up.error) throw new HttpError(502, 'Foto gagal diunggah. Coba lagi.');
  const prev = check(await req.db.from('profiles').select('avatar_url').eq('id', req.user.id).single()) as any;
  check(await req.db.from('profiles').update({ avatar_url: path }).eq('id', req.user.id).select().single());
  if (prev?.avatar_url) await req.db.storage.from(env.STORAGE_BUCKET).remove([prev.avatar_url]);
  res.json(await loadProfile(req));
}));

/** BR-014: hapus akun beserta seluruh data terkait (DB cascade + objek storage). */
profileRoutes.delete('/', wrap(async (req, res) => {
  await removePrefix(`avatars/${req.user.id}`);
  await removePrefix(`materials/${req.user.id}`);
  const { error } = await admin.auth.admin.deleteUser(req.user.id);
  if (error) throw new HttpError(500, 'Akun gagal dihapus. Coba lagi.');
  res.status(204).end();
}));

// ---------- /api/settings ----------
export const settingsRoutes = Router();
settingsRoutes.get('/', wrap(async (req, res) => {
  res.json(check(await req.db.from('user_settings').select('*').eq('user_id', req.user.id).single()));
}));
settingsRoutes.put('/', wrap(async (req, res) => {
  const body = S.settings.parse(req.body);
  const prev = check(await req.db.from('user_settings').select('*').eq('user_id', req.user.id).single()) as any;
  const row = check(await req.db.from('user_settings').update(body).eq('user_id', req.user.id).select().single()) as any;
  // Zona waktu / preferensi notifikasi mempengaruhi jadwal pengingat
  if (body.notifications_enabled === false) await cancelPending(req.db, req.user.id);
  else if ((body.timezone && body.timezone !== prev.timezone) || (body.notifications_enabled && !prev.notifications_enabled)) await resyncUser(req.db, req.user.id);
  res.json(row);
}));

// ---------- /api/push-subscriptions ----------
export const pushRoutes = Router();
pushRoutes.get('/vapid-public-key', wrap(async (_req, res) => res.json({ key: vapidPublicKey() })));
pushRoutes.post('/', wrap(async (req, res) => {
  const body = S.push.parse(req.body);
  const row = check(
    await req.db.from('push_subscriptions')
      .upsert({ ...body, user_id: req.user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'endpoint' })
      .select().single(),
  );
  res.status(201).json(row);
}));
pushRoutes.delete('/:id', wrap(async (req, res) => {
  check(await req.db.from('push_subscriptions').delete().eq('id', req.params.id).select().maybeSingle());
  res.status(204).end();
}));
