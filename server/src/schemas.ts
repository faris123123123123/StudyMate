import { z } from 'zod';
import { HttpError } from './http.js';

export const uuid = z.string().uuid();
const dt = z.string().datetime({ offset: true });
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus berformat #RRGGBB').nullable().optional();
const text = (max: number) => z.string().trim().max(max).nullable().optional();
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam HH:MM');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD');

export const subject = z.object({
  name: z.string().trim().min(1, 'Nama mata kuliah wajib diisi').max(150),
  lecturer: text(150),
  color,
  description: z.string().nullable().optional(),
});

export const schedule = z.object({
  subject_id: uuid.nullable().optional(),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  description: z.string().nullable().optional(),
  category: z.enum(['class', 'self_study', 'assignment', 'exam', 'personal']),
  start_at: dt,
  end_at: dt,
  color,
});
export const scheduleCheck = (m: any) =>
  new Date(m.end_at) > new Date(m.start_at) ? null : 'Waktu selesai harus setelah waktu mulai.';

export const classSchedule = z.object({
  subject_id: uuid,
  day_of_week: z.number().int().min(0).max(6),
  start_time: time,
  end_time: time,
  room: text(100),
  lecturer: text(150),
  valid_from: date,
  valid_until: date.nullable().optional(),
});
export const classCheck = (m: any) => {
  if (String(m.end_time).slice(0, 5) <= String(m.start_time).slice(0, 5)) return 'Jam selesai harus setelah jam mulai.';
  if (m.valid_until && m.valid_until < m.valid_from) return 'Tanggal berakhir tidak boleh sebelum tanggal mulai.';
  return null;
};

export const assignment = z.object({
  subject_id: uuid.nullable().optional(),
  title: z.string().trim().min(1, 'Judul tugas wajib diisi').max(200),
  description: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  due_at: dt.nullable().optional(),
});
export const assignmentBefore = (_req: any, body: any, _op: string, prev?: any) => {
  if (body.status !== undefined) {
    body.completed_at = body.status === 'completed' ? prev?.completed_at ?? new Date().toISOString() : null;
  }
  return body;
};

export const folder = z.object({
  subject_id: uuid.nullable().optional(),
  parent_folder_id: uuid.nullable().optional(),
  name: z.string().trim().min(1, 'Nama folder wajib diisi').max(150),
});
export const folderCheck = (m: any, id?: string) => (id && m.parent_folder_id === id ? 'Folder tidak bisa menjadi induk dirinya sendiri.' : null);

export const materialUpdate = z.object({
  file_name: z.string().trim().min(1).max(255),
  folder_id: uuid.nullable().optional(),
  subject_id: uuid.nullable().optional(),
});

export const note = z.object({
  subject_id: uuid.nullable().optional(),
  title: z.string().trim().min(1, 'Judul catatan wajib diisi').max(200),
  content: z.string().max(200_000).nullable().optional(),
});

export const session = z.object({
  assignment_id: uuid.nullable().optional(),
  session_type: z.enum(['focus', 'short_break', 'long_break']),
  started_at: dt,
  ended_at: dt.nullable().optional(),
  duration_seconds: z.number().int().min(0).max(86_400).optional(),
  status: z.enum(['running', 'paused', 'completed', 'cancelled']).optional(),
});

export const settings = z
  .object({
    theme: z.enum(['light', 'dark']),
    language: z.enum(['id', 'en']),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Zona waktu tidak dikenal'),
    notifications_enabled: z.boolean(),
  })
  .partial();

export const profile = z.object({ full_name: z.string().trim().min(1, 'Nama wajib diisi').max(100) });

export const reminderPatch = z
  .object({ remind_at: dt, status: z.enum(['pending', 'cancelled']) })
  .partial()
  .refine((v) => v.remind_at || v.status, 'Tidak ada perubahan');

export const push = z.object({
  platform: z.enum(['web', 'android', 'ios', 'desktop']),
  endpoint: z.string().min(10),
  subscription_data: z.record(z.any()),
  device_name: text(150),
});

export const fail = (msg: string | null) => {
  if (msg) throw new HttpError(400, msg);
};
