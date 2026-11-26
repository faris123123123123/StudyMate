import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { check } from '../http.js';

const dayKey = (d: Date | string, tz: string) => formatInTimeZone(new Date(d), tz, 'yyyy-MM-dd');

/** Ubah class_schedules (mingguan) menjadi kejadian nyata pada rentang [from, to). */
export function expandClasses(rows: any[], subjects: Map<string, any>, tz: string, from: Date, to: Date) {
  const out: any[] = [];
  const days = Math.min(70, Math.ceil((+to - +from) / 86_400_000) + 2);
  const seen = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const day = dayKey(d, tz);
    if (seen.has(day)) continue;
    seen.add(day);
    const dow = Number(formatInTimeZone(d, tz, 'i')) % 7;
    for (const c of rows) {
      if (c.day_of_week !== dow || day < c.valid_from || (c.valid_until && day > c.valid_until)) continue;
      const t = (x: string) => (x.length === 5 ? `${x}:00` : x);
      const start = fromZonedTime(`${day}T${t(c.start_time)}`, tz);
      const end = fromZonedTime(`${day}T${t(c.end_time)}`, tz);
      if (start >= to || end <= from) continue;
      const s = subjects.get(c.subject_id);
      out.push({
        id: `${c.id}:${day}`, class_id: c.id, kind: 'class', title: s?.name ?? 'Kelas', category: 'class',
        start_at: start.toISOString(), end_at: end.toISOString(), color: s?.color ?? '#3988D7',
        subject_id: c.subject_id, room: c.room, lecturer: c.lecturer ?? s?.lecturer ?? null,
      });
    }
  }
  return out;
}

export async function getSubjects(db: SupabaseClient) {
  const rows = check(await db.from('subjects').select('*').range(0, 999)) as any[];
  return new Map(rows.map((s) => [s.id, s]));
}

/** Statistik belajar untuk Analytics + gamifikasi (XP/level/streak dihitung, tidak disimpan). */
export async function computeStats(db: SupabaseClient, tz: string) {
  const now = new Date();
  const [asg, ses] = await Promise.all([
    db.from('assignments').select('status,due_at').range(0, 4999),
    db.from('study_sessions').select('started_at,duration_seconds').eq('session_type', 'focus').eq('status', 'completed').range(0, 4999),
  ]);
  const tasks = check(asg) as any[];
  const sessions = check(ses) as any[];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const active = total - completed;
  const overdue = tasks.filter((t) => t.status !== 'completed' && t.due_at && new Date(t.due_at) < now).length;
  const totalSeconds = sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(dayKey(s.started_at, tz), (perDay.get(dayKey(s.started_at, tz)) ?? 0) + (s.duration_seconds ?? 0));
  const today = dayKey(now, tz);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = dayKey(addDays(now, i - 6), tz);
    return { date, minutes: Math.round((perDay.get(date) ?? 0) / 60) };
  });
  let streak = 0;
  for (let i = perDay.has(today) ? 0 : 1; i < 400; i++) {
    if (perDay.has(dayKey(addDays(now, -i), tz))) streak++;
    else break;
  }
  const xp = completed * 20 + totalMinutes + streak * 5;
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  return {
    tasks: { total, completed, active, overdue, completionPct: total ? Math.round((completed / total) * 100) : 0 },
    focus: { sessions: sessions.length, totalMinutes, todayMinutes: Math.round((perDay.get(today) ?? 0) / 60), week },
    game: { xp, level, streak, levelStartXp: (level - 1) ** 2 * 40, nextLevelXp: level ** 2 * 40 },
  };
}
