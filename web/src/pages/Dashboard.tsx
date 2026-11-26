import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Mate } from '../components/mate';
import { Bar, Button, Empty, ErrorBox, Loading, Panel, PixelIcon, Tag, type IconName } from '../components/px';
import { api } from '../lib/api';
import { relative } from '../lib/dates';
import { useSettings } from '../lib/settings';
import type { Assignment, PlannerEvent, Profile, Stats } from '../lib/types';

interface Dash { upcoming: PlannerEvent[]; active: Assignment[]; deadlines: Assignment[]; recent: { type: string; title: string; at: string }[]; stats: Stats }
const PRI: Record<string, string> = { high: '#F2B6B6', medium: '#F8DE9A', low: '#B6E3C8' };
const REC: Record<string, IconName> = { note: 'note', file: 'file', task: 'tasks' };

export default function Dashboard() {
  const { fmt, lang, tz } = useSettings();
  const nav = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dash>('/dashboard') });
  const { data: me } = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} retry={refetch} />;
  const { stats } = data;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const g = stats.game;
  const xpPct = ((g.xp - g.levelStartXp) / (g.nextLevelXp - g.levelStartXp)) * 100;
  const mood = stats.focus.todayMinutes > 0 ? 'happy' : 'idle';
  const quick: [string, IconName, string][] = [
    ['Tambah jadwal', 'calendar', '/app/planner?new=1'], ['Tambah tugas', 'tasks', '/app/assignments?new=1'],
    ['Unggah materi', 'upload', '/app/library?upload=1'], ['Buat catatan', 'note', '/app/notes?new=1'], ['Mulai fokus', 'timer', '/app/focus'],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2" tone="soft">
        <div className="flex flex-wrap items-center gap-5">
          <Mate size={112} level={g.level} mood={mood} />
          <div className="min-w-[200px] flex-1">
            <h1 className="mb-2 text-sm leading-relaxed text-primary">{greet}, {me?.full_name?.split(' ')[0] ?? ''}!</h1>
            <p className="mb-2 flex items-center gap-2"><PixelIcon name="trophy" size={16} className="text-gold" />Level {g.level} · {g.xp} XP</p>
            <Bar value={xpPct} color="var(--gold)" label="Progres level" />
            <p className="flex items-center gap-2 text-sm text-muted"><PixelIcon name="flame" size={14} className="text-danger" />Streak {g.streak} hari · {stats.focus.todayMinutes} menit fokus hari ini</p>
          </div>
        </div>
      </Panel>

      <Panel title="Aksi cepat" icon="star">
        <div className="flex flex-wrap">{quick.map(([l, i, to]) => <Button key={l} sm icon={i} variant="alt" onClick={() => nav(to)}>{l}</Button>)}</div>
      </Panel>

      <Panel title="Jadwal terdekat" icon="calendar" className="lg:col-span-2" actions={<Link to="/app/planner" className="text-sm text-secondary underline">Lihat semua</Link>}>
        {data.upcoming.length === 0 ? <Empty icon="calendar" title="Belum ada jadwal" hint="Tambahkan jadwal kuliah atau sesi belajar." action={<Button sm onClick={() => nav('/app/planner?new=1')}>Tambah jadwal</Button>} /> : (
          <ul className="space-y-2">{data.upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-2 pl-3" style={{ borderLeft: `8px solid ${e.color ?? 'var(--secondary)'}` }}>
              <div className="min-w-0 flex-1"><p className="truncate">{e.title}{e.room ? ` · ${e.room}` : ''}</p><p className="text-sm text-muted">{fmt(e.start_at, 'EEE d MMM, HH:mm')}–{fmt(e.end_at, 'HH:mm')}</p></div>
              <Tag>{relative(e.start_at, lang)}</Tag>
            </li>))}</ul>
        )}
      </Panel>

      <Panel title="Ringkasan belajar" icon="chart">
        <dl className="grid grid-cols-2 gap-2 text-center">
          {[['Tugas aktif', stats.tasks.active], ['Terlambat', stats.tasks.overdue], ['Sesi fokus', stats.focus.sessions], ['Menit belajar', stats.focus.totalMinutes]].map(([l, v]) => (
            <div key={l} className="px-soft p-2"><dd className="font-pixel text-sm text-primary">{v}</dd><dt className="text-sm text-muted">{l}</dt></div>))}
        </dl>
      </Panel>

      <Panel title="Tugas aktif" icon="tasks" actions={<Link to="/app/assignments" className="text-sm text-secondary underline">Kelola</Link>}>
        {data.active.length === 0 ? <Empty icon="check" title="Semua beres!" hint="Tidak ada tugas aktif." /> : (
          <ul className="space-y-2">{data.active.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="truncate">{a.title}</span><Tag color={PRI[a.priority]}>{a.priority}</Tag></li>)}</ul>)}
      </Panel>

      <Panel title="Deadline 7 hari" icon="clock">
        {data.deadlines.length === 0 ? <Empty icon="clock" title="Tidak ada deadline dekat" /> : (
          <ul className="space-y-2">{data.deadlines.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span className="truncate">{a.title}</span><Tag>{relative(a.due_at!, lang)}</Tag></li>)}</ul>)}
      </Panel>

      <Panel title="Aktivitas terbaru" icon="star">
        {data.recent.length === 0 ? <Empty title="Belum ada aktivitas" /> : (
          <ul className="space-y-2">{data.recent.map((r, i) => <li key={i} className="flex items-center gap-2"><PixelIcon name={REC[r.type]} size={16} className="text-secondary" /><span className="min-w-0 flex-1 truncate">{r.title}</span><span className="text-xs text-muted">{fmt(r.at, 'd MMM')}</span></li>)}</ul>)}
      </Panel>
    </div>
  );
}
