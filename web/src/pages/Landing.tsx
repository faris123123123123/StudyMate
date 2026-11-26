import { Link } from 'react-router-dom';
import { Mate } from '../components/mate';
import { Button, Panel, PixelIcon, type IconName } from '../components/px';

const FEATURES: [IconName, string, string][] = [
  ['calendar', 'Study Planner', 'Jadwal harian, mingguan, dan bulanan dalam satu kalender.'],
  ['tasks', 'Tugas', 'Pantau prioritas, status, dan deadline sebelum terlambat.'],
  ['folder', 'Study Library', 'Simpan PDF, dokumen, dan gambar di cloud privat.'],
  ['note', 'My Notes', 'Catatan per mata kuliah, tersimpan otomatis.'],
  ['timer', 'Focus Mode', 'Pomodoro dengan riwayat sesi. Mate menemanimu.'],
  ['bell', 'Pengingat', 'Notifikasi kelas, sesi belajar, dan deadline.'],
  ['chart', 'Statistik', 'Lihat progres belajar, level, dan streak.'],
  ['star', 'Sinkron', 'Web, desktop, dan ponsel memakai akun yang sama.'],
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-10 flex items-center justify-between">
        <span className="font-pixel text-xs text-primary">STUDYMATE</span>
        <div className="flex"><Link to="/login"><Button variant="alt" sm>Masuk</Button></Link><Link to="/register"><Button sm>Daftar</Button></Link></div>
      </header>
      <section className="mb-12 grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="mb-4 text-xl leading-relaxed text-primary sm:text-2xl">Belajar rapi, level naik.</h1>
          <p className="mb-6 max-w-md text-lg">Jadwal kuliah, tugas, materi, dan catatan ada di satu tempat. Selesaikan tugas dan sesi fokus untuk membesarkan Mate, temanmu belajar.</p>
          <Link to="/register"><Button icon="play" variant="gold">Mulai gratis</Button></Link>
        </div>
        <div className="px px-soft grid place-items-center p-6">
          <div className="px mb-4 p-2 text-sm">Halo! Ayo atur belajarmu hari ini.</div>
          <Mate size={160} mood="happy" level={4} />
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(([i, t, d]) => (
          <Panel key={t}><PixelIcon name={i} size={28} className="mb-2 text-secondary" /><h3 className="mb-2 text-[10px]">{t}</h3><p className="text-muted">{d}</p></Panel>
        ))}
      </div>
    </div>
  );
}
