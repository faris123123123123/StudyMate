import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';
import { admin } from '../supabase.js';
import { pushTo } from './push.js';
import { TABLE_OF, syncReminders, type SourceType } from './reminders.js';

async function describe(r: any, tz: string) {
  const { data: row } = await admin.from(TABLE_OF[r.source_type as SourceType]).select('*').eq('id', r.source_id).maybeSingle();
  if (!row) throw new Error('sumber tidak ditemukan');
  const at = (iso: string, p: string) => formatInTimeZone(new Date(iso), tz, p);
  if (r.source_type === 'assignment')
    return { type: 'deadline_near', title: `Deadline mendekat: ${row.title}`, message: `Batas pengumpulan ${at(row.due_at, 'dd MMM yyyy, HH:mm')}.`, url: '/app/assignments' };
  if (r.source_type === 'class_schedule') {
    const { data: s } = await admin.from('subjects').select('name').eq('id', row.subject_id).maybeSingle();
    return { type: 'schedule_start', title: `Kelas segera dimulai: ${s?.name ?? 'Kelas'}`, message: `Mulai pukul ${String(row.start_time).slice(0, 5)}${row.room ? `, ruang ${row.room}` : ''}.`, url: '/app/classes' };
  }
  const study = row.category === 'self_study' || row.category === 'exam';
  return { type: study ? 'study_reminder' : 'schedule_start', title: `Segera: ${row.title}`, message: `Mulai pukul ${at(row.start_at, 'HH:mm')}.`, url: '/app/planner' };
}

/** Klaim atomik (UPDATE ... WHERE status='pending') mencegah pengingat terkirim dua kali (REM-001). */
export async function processDue() {
  const { data } = await admin.from('reminders').select('*').eq('status', 'pending').lte('remind_at', new Date().toISOString()).order('remind_at').limit(100);
  for (const r of data ?? []) {
    const { data: claimed } = await admin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'pending').select().maybeSingle();
    if (!claimed) continue;
    try {
      const { data: prefs } = await admin.from('user_settings').select('timezone,notifications_enabled').eq('user_id', r.user_id).maybeSingle();
      const n = await describe(r, prefs?.timezone ?? 'Asia/Jakarta');
      const { error: notificationError } = await admin.from('notifications').insert({ user_id: r.user_id, title: n.title, message: n.message, type: n.type });
      if (notificationError) throw notificationError;
      if (prefs?.notifications_enabled !== false) await pushTo(r.user_id, { title: n.title, message: n.message, url: n.url });
    } catch (e) {
      console.error('reminder gagal', r.id, e);
      // Keep the reminder retryable instead of recording it as sent when
      // notification persistence failed.
      await admin.from('reminders').update({ status: 'pending', sent_at: null }).eq('id', r.id).eq('status', 'sent');
    }
  }
}

/** Perpanjang horizon pengingat kelas berulang (7 hari ke depan). */
export async function refreshClassReminders() {
  const { data } = await admin.from('class_schedules').select('*');
  for (const c of data ?? []) await syncReminders(admin, c.user_id, 'class_schedule', c);
}

export function startWorker() {
  cron.schedule('* * * * *', () => processDue().catch(console.error));
  cron.schedule('5 0 * * *', () => refreshClassReminders().catch(console.error));
  refreshClassReminders().catch(console.error);
  console.log('Reminder worker aktif');
}
