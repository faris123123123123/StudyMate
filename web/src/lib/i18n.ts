/** Kamus ringkas untuk navigasi, judul, dan tombol umum. Teks lain berbahasa Indonesia. */
const D: Record<string, { id: string; en: string }> = {
  dashboard: { id: 'Beranda', en: 'Dashboard' },
  planner: { id: 'Planner', en: 'Planner' },
  classes: { id: 'Kelas', en: 'Classes' },
  assignments: { id: 'Tugas', en: 'Assignments' },
  library: { id: 'Pustaka', en: 'Library' },
  notes: { id: 'Catatan', en: 'Notes' },
  focus: { id: 'Fokus', en: 'Focus' },
  analytics: { id: 'Statistik', en: 'Analytics' },
  notifications: { id: 'Notifikasi', en: 'Notifications' },
  settings: { id: 'Pengaturan', en: 'Settings' },
  save: { id: 'Simpan', en: 'Save' },
  cancel: { id: 'Batal', en: 'Cancel' },
  delete: { id: 'Hapus', en: 'Delete' },
  edit: { id: 'Ubah', en: 'Edit' },
  add: { id: 'Tambah', en: 'Add' },
  logout: { id: 'Keluar', en: 'Log out' },
  search: { id: 'Cari...', en: 'Search...' },
  today: { id: 'Hari ini', en: 'Today' },
  loading: { id: 'Memuat...', en: 'Loading...' },
};
export const makeT = (lang: string) => (k: string) => D[k]?.[lang === 'en' ? 'en' : 'id'] ?? k;
