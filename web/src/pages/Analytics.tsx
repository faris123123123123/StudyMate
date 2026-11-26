import { useQuery } from '@tanstack/react-query';
import { Mate } from '../components/mate';
import { Bar, ErrorBox, Loading, PageHead, Panel, PixelIcon } from '../components/px';
import { api } from '../lib/api';
import { labelOfDay } from '../lib/dates';
import { useSettings } from '../lib/settings';
import type { Stats } from '../lib/types';

export default function Analytics() {
  const { lang } = useSettings();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['analytics'], queryFn: () => api<Stats>('/analytics') });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} retry={refetch} />;
  const { tasks, focus, game } = data;
  const max = Math.max(30, ...focus.week.map((w) => w.minutes));
  const hours = Math.floor(focus.totalMinutes / 60), mins = focus.totalMinutes % 60;
  const tiles: [string, string | number][] = [['Total tugas', tasks.total], ['Selesai', tasks.completed], ['Belum selesai', tasks.active], ['Sesi belajar', focus.sessions], ['Total waktu', `${hours}j ${mins}m`], ['Terlambat', tasks.overdue]];

  return (
    <>
      <PageHead title="Statistik Belajar" icon="chart" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, v]) => <div key={l} className="px p-3 text-center"><p className="font-pixel text-sm text-primary">{v}</p><p className="mt-2 text-sm text-muted">{l}</p></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Aktivitas 7 hari (menit fokus)" icon="chart" className="lg:col-span-2">
          <div className="flex h-48 items-end gap-2" role="img" aria-label={`Menit fokus per hari: ${focus.week.map((w) => `${w.date} ${w.minutes}`).join(', ')}`}>
            {focus.week.map((w) => (
              <div key={w.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs">{w.minutes}</span>
                <div className="w-full" style={{ height: `${(w.minutes / max) * 100}%`, minHeight: 4, background: 'repeating-linear-gradient(0deg, var(--secondary) 0 10px, var(--primary) 10px 12px)', boxShadow: '0 -4px 0 0 var(--line), -4px 0 0 0 var(--line), 4px 0 0 0 var(--line)' }} />
                <span className="text-xs text-muted">{labelOfDay(w.date, 'EEE', lang)}</span>
              </div>))}
          </div>
        </Panel>
        <Panel title="Penyelesaian tugas" icon="tasks">
          <p className="mb-2 font-pixel text-lg text-grass">{tasks.completionPct}%</p>
          <Bar value={tasks.completionPct} color="var(--grass)" label="Persentase tugas selesai" />
          <p className="text-sm text-muted">{tasks.completed} dari {tasks.total} tugas selesai.</p>
        </Panel>
        <Panel title="Level Mate" icon="trophy" className="lg:col-span-3" tone="soft">
          <div className="flex flex-wrap items-center gap-6">
            <Mate size={96} level={game.level} mood="happy" />
            <div className="min-w-[220px] flex-1">
              <p className="mb-1 flex items-center gap-2"><PixelIcon name="trophy" size={18} className="text-gold" />Level {game.level} · {game.xp} / {game.nextLevelXp} XP</p>
              <Bar value={((game.xp - game.levelStartXp) / (game.nextLevelXp - game.levelStartXp)) * 100} color="var(--gold)" label="Menuju level berikutnya" />
              <p className="flex items-center gap-2 text-sm text-muted"><PixelIcon name="flame" size={14} className="text-danger" />Streak {game.streak} hari berturut-turut</p>
              <p className="mt-2 text-sm text-muted">XP = 20 per tugas selesai + 1 per menit fokus + 5 per hari streak. Dihitung dari datamu, tidak disimpan terpisah.</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
