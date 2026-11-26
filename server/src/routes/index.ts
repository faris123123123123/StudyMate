import { Router } from 'express';
import { crud } from '../crud.js';
import { requireAuth } from '../http.js';
import * as S from '../schemas.js';
import { syncReminders } from '../services/reminders.js';
import { profileRoutes, pushRoutes, settingsRoutes } from './account.js';
import { analyticsRoutes, dashboardRoutes, notificationRoutes, plannerRoutes, reminderRoutes } from './data.js';
import { materialRoutes } from './library.js';

const STATUS_ID: Record<string, string> = { not_started: 'belum dimulai', in_progress: 'sedang dikerjakan', completed: 'selesai' };

export const api = Router();
api.use(requireAuth);

api.use('/profile', profileRoutes);
api.use('/settings', settingsRoutes);
api.use('/push-subscriptions', pushRoutes);
api.use('/notifications', notificationRoutes);
api.use('/reminders', reminderRoutes);
api.use('/planner', plannerRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/analytics', analyticsRoutes);
api.use('/materials', materialRoutes);

api.use('/subjects', crud({ table: 'subjects', create: S.subject, order: { col: 'name', asc: true }, search: ['name'] }));

api.use('/schedules', crud({
  table: 'schedules', create: S.schedule, validate: S.scheduleCheck,
  filters: ['subject_id', 'category'], range: 'start_at', order: { col: 'start_at', asc: true },
  after: (req, row, op) => (op === 'delete' ? undefined : syncReminders(req.db, req.user.id, 'schedule', row)),
}));

api.use('/class-schedules', crud({
  table: 'class_schedules', create: S.classSchedule, validate: S.classCheck,
  filters: ['subject_id', 'day_of_week'], order: { col: 'day_of_week', asc: true },
  after: (req, row, op) => (op === 'delete' ? undefined : syncReminders(req.db, req.user.id, 'class_schedule', row)),
}));

api.use('/assignments', crud({
  table: 'assignments', create: S.assignment, before: S.assignmentBefore,
  filters: ['status', 'priority', 'subject_id'], search: ['title'], range: 'due_at',
  sortable: ['due_at', 'created_at', 'title'], order: { col: 'due_at', asc: true },
  after: async (req, row, op, prev) => {
    if (op === 'delete') return;
    await syncReminders(req.db, req.user.id, 'assignment', row);
    if (op === 'update' && prev && prev.status !== row.status)
      await req.db.from('notifications').insert({
        user_id: req.user.id, type: 'status_change', title: 'Status tugas diperbarui',
        message: `"${row.title}" sekarang ${STATUS_ID[row.status]}.`,
      });
  },
}));

api.use('/study-folders', crud({
  table: 'study_folders', create: S.folder, validate: S.folderCheck,
  filters: ['subject_id', 'parent_folder_id'], order: { col: 'name', asc: true },
}));

api.use('/notes', crud({
  table: 'notes', create: S.note, filters: ['subject_id'], search: ['title', 'content'], order: { col: 'updated_at' },
}));

api.use('/study-sessions', crud({
  table: 'study_sessions', create: S.session, filters: ['assignment_id', 'status', 'session_type'],
  range: 'started_at', order: { col: 'started_at' }, methods: ['list', 'get', 'create', 'update'],
}));
