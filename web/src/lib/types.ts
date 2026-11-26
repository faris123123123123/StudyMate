/** Tipe mengikuti ERD (SRS bagian 8) kolom per kolom. */
export interface Profile { id: string; full_name: string; avatar_url: string | null; created_at: string; updated_at: string; email?: string; avatar_signed_url?: string | null }
export interface UserSettings { id: string; user_id: string; theme: 'light' | 'dark'; language: 'id' | 'en'; timezone: string; notifications_enabled: boolean; updated_at: string }
export interface Subject { id: string; name: string; lecturer: string | null; color: string | null; description: string | null; updated_at: string }
export type Category = 'class' | 'self_study' | 'assignment' | 'exam' | 'personal';
export interface Schedule { id: string; subject_id: string | null; title: string; description: string | null; category: Category; start_at: string; end_at: string; color: string | null; updated_at: string }
export interface PlannerEvent extends Partial<Schedule> { id: string; kind: 'schedule' | 'class'; title: string; category: Category; start_at: string; end_at: string; color: string | null; room?: string | null; lecturer?: string | null; class_id?: string }
export interface ClassSchedule { id: string; subject_id: string; day_of_week: number; start_time: string; end_time: string; room: string | null; lecturer: string | null; valid_from: string; valid_until: string | null; updated_at: string }
export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export interface Assignment { id: string; subject_id: string | null; title: string; description: string | null; priority: Priority; status: TaskStatus; due_at: string | null; completed_at: string | null; created_at: string; updated_at: string }
export interface Folder { id: string; subject_id: string | null; parent_folder_id: string | null; name: string; updated_at: string }
export interface Material { id: string; subject_id: string | null; folder_id: string | null; file_name: string; storage_path: string; file_type: string; mime_type: string; file_size: number; processing_status: 'uploading' | 'ready' | 'failed'; created_at: string; updated_at: string; signed_url?: string }
export interface Note { id: string; subject_id: string | null; title: string; content: string | null; created_at: string; updated_at: string }
export interface Reminder { id: string; source_type: string; source_id: string; remind_at: string; status: string; source_title: string }
export interface AppNotification { id: string; title: string; message: string; type: 'schedule_start' | 'deadline_near' | 'study_reminder' | 'status_change'; is_read: boolean; created_at: string }
export interface StudySession { id: string; assignment_id: string | null; session_type: 'focus' | 'short_break' | 'long_break'; started_at: string; ended_at: string | null; duration_seconds: number; status: 'running' | 'paused' | 'completed' | 'cancelled' }
export interface Stats {
  tasks: { total: number; completed: number; active: number; overdue: number; completionPct: number };
  focus: { sessions: number; totalMinutes: number; todayMinutes: number; week: { date: string; minutes: number }[] };
  game: { xp: number; level: number; streak: number; levelStartXp: number; nextLevelXp: number };
}
export interface Paged<T> { data: T[]; total: number; page: number; pageSize: number }
