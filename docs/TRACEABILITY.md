# Keterkaitan PRD → SRS → ERD → Kode

Sumber: `PRD.docx` v2.0, `SRS dan ERD.docx` v1.0 (26 Nov 2026). Basis tabel database adalah **SRS bagian 6–8 (13 tabel)**; daftar 10 tabel di PRD bagian 10 sudah tertinggal (tidak memuat `class_schedules`, `study_folders`, `push_subscriptions`).

## Peta fitur

| PRD | SRS | Tabel (ERD) | API | Halaman |
|---|---|---|---|---|
| AUTH-001 | SRS-AUTH-001, BR-001/003 | `auth.users`, `profiles`, `user_settings` (trigger `handle_new_user`) | Supabase Auth SDK | `pages/Auth.tsx` |
| PROF-001 | – | `profiles`, Storage `avatars/{uid}` | `/api/profile`, `/api/profile/avatar` | `Settings → Profil` |
| DASH-001 | SRS-DASH-001 | semua (agregat) | `/api/dashboard` | `Dashboard.tsx` |
| PLAN-001 | SRS-PLAN-001, BR-004/005 | `schedules` (+`subjects`) | `/api/schedules`, `/api/planner` | `Planner.tsx` |
| CLASS-001 | SRS-CLASS-001 | `class_schedules`, `subjects` | `/api/class-schedules`, `/api/subjects` | `Classes.tsx` |
| TASK-001 | SRS-TASK-001, BR-006/007 | `assignments` (Overdue dihitung, tidak disimpan) | `/api/assignments` | `Assignments.tsx` |
| LIB-001 | SRS-LIB-001, BR-008/009 | `study_folders`, `study_materials`, bucket privat | `/api/study-folders`, `/api/materials` | `Library.tsx` |
| NOTE-001 | SRS-NOTE-001 | `notes` | `/api/notes` | `Notes.tsx` |
| REM-001 | SRS-REM-001, BR-010 | `reminders` (+trigger cleanup) | `/api/reminders`, worker | `Notifications.tsx` |
| NOTIF-001 | SRS-NOTIF-001, BR-011 | `notifications`, `push_subscriptions` | `/api/notifications`, `/api/push-subscriptions` | `Notifications.tsx`, `sw.ts` |
| FOCUS-001 | SRS-FOCUS-001, BR-012 | `study_sessions` | `/api/study-sessions` | `Focus.tsx` |
| ANALYTICS-001 | SRS-ANALYTICS-001 | agregat `assignments`, `study_sessions` | `/api/analytics` | `Analytics.tsx` |
| SET-001 | SRS-SET-001 | `user_settings` | `/api/settings` | `Settings.tsx` |
| BR-014 | – | `ON DELETE CASCADE` dari `auth.users` | `DELETE /api/profile` | `Settings → Akun` |

## Kesesuaian dengan ERD

* Semua kolom, tipe, default, dan aturan ON DELETE mengikuti SRS 8.1–8.13 (`supabase/migrations/0001_init.sql`).
* Yang **ditambahkan** hanya constraint/trigger/index, bukan kolom: CHECK nilai enum (SRS 10.3), `end_at > start_at`, `file_size > 0`, `UNIQUE(source_type, source_id, remind_at)` (anti pengingat ganda), `UNIQUE(endpoint)`, trigger kepemilikan lintas-relasi, trigger pembersih `reminders`, index SRS bagian 11, dan policy storage.
* Aturan hapus yang dipilih (SRS 6.2 meminta kehati-hatian): `subject_id` pada jadwal/tugas/catatan/materi/folder → `SET NULL` (data dipertahankan); `class_schedules.subject_id` → `CASCADE`; `study_materials.folder_id` → `SET NULL`; `study_sessions.assignment_id` → `SET NULL`; anak-anak `profiles` → `CASCADE`.

## Celah antar-dokumen (perlu keputusan Anda)

Kebutuhan di PRD/SRS yang **tidak punya kolom/tabel di ERD**. Saya tidak mengubah ERD; berikut cara saya menanganinya dan usulan perbaikan.

| # | Kebutuhan | Penanganan sekarang | Usulan (ubah ERD + SRS bila disetujui) |
|---|---|---|---|
| 1 | Lampiran tugas (PRD 6.6, SRS 3.6) | Belum ada | Tambah `assignment_id` (nullable, FK) di `study_materials` |
| 2 | Jadwal berulang di Planner (PRD 6.4, SRS 3.4 "pengaturan pengulangan") | Hanya kelas mingguan via `class_schedules`; `schedules` tidak berulang | Tambah `recurrence_rule` (mis. RRULE) di `schedules` |
| 3 | Catatan tambahan kelas (PRD 6.5) | Memakai `subjects.description` | Tambah `notes` di `class_schedules` |
| 4 | Preferensi pengingat (PRD 6.13, SRS 3.13) | Default tetap di backend; tiap pengingat bisa diubah/dimatikan per item; saklar global di `notifications_enabled` | Tambah offset per jenis di `user_settings` |
| 5 | Durasi Pomodoro bisa diatur (PRD 6.11) | Disimpan di `localStorage` per perangkat | Tambah kolom durasi di `user_settings` |
| 6 | "Tugas penting" (PRD 6.9) | Diartikan `priority = high` | Tetapkan definisinya di SRS |
| 7 | Default pengingat ujian | PRD tidak menyebut; dipakai 1 hari sebelumnya | Tetapkan di SRS 3.9 |

## Penyimpangan desain yang disengaja

PRD 8.3 menyebut gaya *modern, minimalist, clean* dengan font Inter dan ikon Lucide. Atas permintaan Anda UI diganti **pixel art**: font Press Start 2P + Pixelify Sans, ikon bitmap 8×8 buatan sendiri, bingkai bertakik. **Palet warna PRD dipertahankan** (`#174A82`, `#3988D7`, `#F4F7FB`, `#FFFFFF`, `#172B4D`, `#718096`) dengan aksen emas/hijau/ungu dan mode gelap. Disarankan menjadikannya PRD v2.1.

## Belum tercakup MVP ini

* Push native Android/iOS (butuh FCM/APNs); web dan desktop memakai Web Push.
* Auto-update Tauri (butuh signing key; tambahkan `tauri-plugin-updater`).
* Bahasa Inggris hanya untuk navigasi dan tombol umum; isi halaman berbahasa Indonesia.
* Pratinjau DOCX/PPTX/XLSX (sesuai catatan PRD 6.7: pratinjau PDF, gambar, teks dulu) dan OCR.
* Sinkronisasi offline (SRS 12.2: pascaMVP). Konflik edit ditangani lewat `expected_updated_at` → HTTP 409.
