import { Router } from 'express';
import { HttpError, check, wrap } from '../http.js';
import * as S from '../schemas.js';
import { TABLE_OF, userPrefs, type SourceType } from '../services/reminders.js';
import { computeStats, expandClasses, getSubjects } from '../services/stats.js';

export const dataRoutes = Router();

// ---------- Notifications ----------
export const notificationRoutes = Router();
notificationRoutes.get('/', wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
  let q = req.db.from('notifications').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (req.query.is_read === 'false') q = q.eq('is_read', false);
  const { data, error, count } = await q.range((page - 1) * size, page * size - 1);
  if (error) throw new HttpError(500, error.message);
  res.json({ data, total: count ?? 0, page, pageSize: size });
}));
notificationRoutes.get('/unread-count', wrap(async (req, res) => {
  const { count } = await req.db.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
  res.json({ count: count ?? 0 });
}));
notificationRoutes.post('/read-all', wrap(async (req, res) => {
  check(await req.db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false).select('id'));
  res.status(204).end();
}));
notificationRoutes.patch('/:id/read', wrap(async (req, res) => {
  const row = check(await req.db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle());
  if (!row) throw new HttpError(404, 'Notifikasi tidak ditemukan.');
  res.json(row);
}));
notificationRoutes.delete('/:id', wrap(async (req, res) => {
  check(await req.db.from('notifications').delete().eq('id', req.params.id).select().maybeSingle());
  res.status(204).end();
}));

// ---------- Reminders (pengguna dapat mengubah waktu / menonaktifkan) ----------
export const reminderRoutes = Router();
reminderRoutes.get('/', wrap(async (req, res) => {
  const rows = check(
    await req.db.from('reminders').select('*').in('status', ['pending', 'cancelled']).gt('remind_at', new Date().toISOString()).order('remind_at').limit(100),
  ) as any[];
  const titles = new Map<string, string>();
  for (const type of Object.keys(TABLE_OF) as SourceType[]) {
    const ids = rows.filter((r) => r.source_type === type).map((r) => r.source_id);
    if (!ids.length) continue;
    const sel = type === 'class_schedule' ? 'id,subject_id' : 'id,title';
    const { data } = await req.db.from(TABLE_OF[type]).select(sel).in('id', ids);
    const subj = type === 'class_schedule' ? await getSubjects(req.db) : null;
    for (const d of (data ?? []) as any[]) titles.set(d.id, subj ? subj.get(d.subject_id)?.name ?? 'Kelas' : d.title);
  }
  res.json({ data: rows.map((r) => ({ ...r, source_title: titles.get(r.source_id) ?? '(dihapus)' })) });
}));
reminderRoutes.patch('/:id', wrap(async (req, res) => {
  const body = S.reminderPatch.parse(req.body);
  const prev = check(await req.db.from('reminders').select('*').eq('id', req.params.id).maybeSingle()) as any;
  if (!prev) throw new HttpError(404, 'Pengingat tidak ditemukan.');
  if (prev.status === 'sent' || prev.status === 'failed') throw new HttpError(400, 'Pengingat yang sudah diproses tidak bisa diubah.');
  const next = { ...prev, ...body };
  if (next.status === 'pending' && new Date(next.remind_at) <= new Date()) throw new HttpError(400, 'Waktu pengingat harus di masa depan.');
  const row = check(await req.db.from('reminders').update(body).eq('id', prev.id).select().single());
  res.json(row);
}));

// ---------- Planner: jadwal + kelas berulang yang sudah diuraikan ----------
export const plannerRoutes = Router();
plannerRoutes.get('/', wrap(async (req, res) => {
  const from = new Date(String(req.query.from)), to = new Date(String(req.query.to));
  if (isNaN(+from) || isNaN(+to) || to <= from) throw new HttpError(400, 'Rentang tanggal tidak valid.');
  if (+to - +from > 70 * 86_400_000) throw new HttpError(400, 'Rentang maksimal 70 hari.');
  const { tz } = await userPrefs(req.db, req.user.id);
  const [sch, cls, subjects] = await Promise.all([
    req.db.from('schedules').select('*').lt('start_at', to.toISOString()).gt('end_at', from.toISOString()).order('start_at').limit(500),
    req.db.from('class_schedules').select('*').range(0, 499),
    getSubjects(req.db),
  ]);
  const schedules = (check(sch) as any[]).map((s) => ({ ...s, kind: 'schedule', color: s.color ?? subjects.get(s.subject_id)?.color ?? null }));
  const events = [...schedules, ...expandClasses(check(cls) as any[], subjects, tz, from, to)].sort((a, b) => a.start_at.localeCompare(b.start_at));
  res.json({ data: events });
}));

// ---------- Dashboard ----------
export const dashboardRoutes = Router();
dashboardRoutes.get('/', wrap(async (req, res) => {
  const now = new Date();
  const { tz } = await userPrefs(req.db, req.user.id);
  const weekAhead = new Date(+now + 7 * 86_400_000);
  const [plan, subjects, active, deadlines, notes, files, stats] = await Promise.all([
    req.db.from('schedules').select('*').gt('end_at', now.toISOString()).order('start_at').limit(8),
    getSubjects(req.db),
    req.db.from('assignments').select('*').neq('status', 'completed').order('due_at', { ascending: true }).limit(5),
    req.db.from('assignments').select('*').neq('status', 'completed').gte('due_at', now.toISOString()).lt('due_at', weekAhead.toISOString()).order('due_at').limit(5),
    req.db.from('notes').select('id,title,updated_at').order('updated_at', { ascending: false }).limit(4),
    req.db.from('study_materials').select('id,file_name,created_at').order('created_at', { ascending: false }).limit(4),
    computeStats(req.db, tz),
  ]);
  const cls = check(await req.db.from('class_schedules').select('*').range(0, 499)) as any[];
  const upcoming = [
    ...(check(plan) as any[]).map((s) => ({ ...s, kind: 'schedule' })),
    ...expandClasses(cls, subjects, tz, now, weekAhead).filter((e) => new Date(e.end_at) > now),
  ].sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 6);
  const recent = [
    ...(check(notes) as any[]).map((n) => ({ type: 'note', title: n.title, at: n.updated_at })),
    ...(check(files) as any[]).map((f) => ({ type: 'file', title: f.file_name, at: f.created_at })),
    ...(check(active) as any[]).map((a) => ({ type: 'task', title: a.title, at: a.updated_at ?? a.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  res.json({ upcoming, active: check(active), deadlines: check(deadlines), recent, stats });
}));

// ---------- Analytics ----------
export const analyticsRoutes = Router();
analyticsRoutes.get('/', wrap(async (req, res) => {
  const { tz } = await userPrefs(req.db, req.user.id);
  res.json(await computeStats(req.db, tz));
}));
