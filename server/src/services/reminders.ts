import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, subDays, subMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export type SourceType = 'schedule' | 'assignment' | 'class_schedule';
export const TABLE_OF: Record<SourceType, string> = { schedule: 'schedules', assignment: 'assignments', class_schedule: 'class_schedules' };

/** Default pengingat sesuai PRD 6.9: kelas 15 menit, belajar 30 menit, deadline 1 hari, tugas penting 3 hari + 1 hari. */
export function planReminders(type: SourceType, row: any, tz: string, now = new Date()): Date[] {
  let times: Date[] = [];
  if (type === 'schedule') {
    const start = new Date(row.start_at);
    const off = row.category === 'class' ? () => subMinutes(start, 15) : row.category === 'exam' ? () => subDays(start, 1) : () => subMinutes(start, 30);
    times = [off()];
  } else if (type === 'assignment') {
    if (!row.due_at || row.status === 'completed') return [];
    const due = new Date(row.due_at);
    times = row.priority === 'high' ? [subDays(due, 3), subDays(due, 1)] : [subDays(due, 1)];
  } else {
    // class_schedule: kemunculan 7 hari ke depan (diperpanjang tiap hari oleh worker)
    const start = row.start_time.length === 5 ? `${row.start_time}:00` : row.start_time;
    for (let i = 0; i <= 7; i++) {
      const d = addDays(now, i);
      const day = formatInTimeZone(d, tz, 'yyyy-MM-dd');
      const dow = Number(formatInTimeZone(d, tz, 'i')) % 7; // ISO 1..7 -> 0=Minggu
      if (dow !== row.day_of_week || day < row.valid_from || (row.valid_until && day > row.valid_until)) continue;
      times.push(subMinutes(fromZonedTime(`${day}T${start}`, tz), 15));
    }
  }
  return times.filter((t) => t > now);
}

export async function userPrefs(db: SupabaseClient, userId: string) {
  const { data } = await db.from('user_settings').select('timezone,notifications_enabled').eq('user_id', userId).maybeSingle();
  return { tz: data?.timezone ?? 'Asia/Jakarta', enabled: data?.notifications_enabled ?? true };
}

/** Batalkan pengingat pending lama lalu buat ulang. Pengingat yang dinonaktifkan pengguna (cancelled) tetap tidak aktif. */
export async function syncReminders(db: SupabaseClient, userId: string, type: SourceType, row: any) {
  const { tz, enabled } = await userPrefs(db, userId);
  await db.from('reminders').delete().eq('source_type', type).eq('source_id', row.id).eq('status', 'pending');
  if (!enabled) return;
  const times = planReminders(type, row, tz);
  if (!times.length) return;
  await db.from('reminders').upsert(
    times.map((t) => ({ user_id: userId, source_type: type, source_id: row.id, remind_at: t.toISOString(), status: 'pending' })),
    { onConflict: 'source_type,source_id,remind_at', ignoreDuplicates: true },
  );
}

/** Dipakai saat zona waktu / preferensi notifikasi berubah. */
export async function resyncUser(db: SupabaseClient, userId: string) {
  const nowIso = new Date().toISOString();
  const [s, a, c] = await Promise.all([
    db.from('schedules').select('*').gt('start_at', nowIso),
    db.from('assignments').select('*').neq('status', 'completed').gt('due_at', nowIso),
    db.from('class_schedules').select('*'),
  ]);
  for (const r of s.data ?? []) await syncReminders(db, userId, 'schedule', r);
  for (const r of a.data ?? []) await syncReminders(db, userId, 'assignment', r);
  for (const r of c.data ?? []) await syncReminders(db, userId, 'class_schedule', r);
}

export async function cancelPending(db: SupabaseClient, userId: string) {
  await db.from('reminders').delete().eq('user_id', userId).eq('status', 'pending');
}
