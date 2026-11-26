import { useEffect, useRef, useState } from 'react';
import { Mate, type Mood } from '../components/mate';
import { Bar, Button, Field, Modal, PageHead, Panel, Tag, useToast } from '../components/px';
import { api } from '../lib/api';
import { useInfinite, useList, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { Assignment, StudySession } from '../lib/types';

type Mode = 'focus' | 'short_break' | 'long_break';
const LABEL: Record<Mode, string> = { focus: 'Fokus', short_break: 'Istirahat singkat', long_break: 'Istirahat panjang' };
interface Run { sessionId: string; mode: Mode; plannedSec: number; status: 'running' | 'paused'; segStart: number; before: number }

const DEFAULTS: Record<Mode, number> = { focus: 25, short_break: 5, long_break: 15 }; // menit (PRD 6.11)
const loadDur = (): Record<Mode, number> => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sm-focus-dur') ?? '{}') }; } catch { return DEFAULTS; } };
const loadRun = (): Run | null => { try { return JSON.parse(localStorage.getItem('sm-focus-run') ?? 'null'); } catch { return null; } };

function beep() {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 660; g.gain.value = 0.05; o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(() => { o.frequency.value = 880; }, 150); setTimeout(() => { o.stop(); ctx.close(); }, 350);
  } catch { /* audio tidak tersedia */ }
}

export default function Focus() {
  const { toast } = useToast();
  const { fmt } = useSettings();
  const [dur, setDur] = useState(loadDur);
  const [mode, setMode] = useState<Mode>('focus');
  const [run, setRun] = useState<Run | null>(loadRun);
  const [now, setNow] = useState(Date.now());
  const [task, setTask] = useState('');
  const [cfg, setCfg] = useState(false);
  const [done, setDone] = useState(0); const [mood, setMood] = useState<Mood>('idle');
  const finishing = useRef(false);
  const tasks = useList<Assignment>('assignments', '/assignments', { status_not: 'completed' });
  const hist = useInfinite<StudySession>('sessions', '/study-sessions', {}, 10);
  const patch = (id: string, body: object) => api(`/study-sessions/${id}`, { method: 'PUT', body });
  const start = useMut((v: { mode: Mode; planned: number }) => api<StudySession>('/study-sessions', { method: 'POST', body: { session_type: v.mode, assignment_id: v.mode === 'focus' && task ? task : null, started_at: new Date().toISOString(), status: 'running' } }).then((s) => ({ s, ...v })),
    undefined, ({ s, mode: m, planned }) => setRun({ sessionId: s.id, mode: m, plannedSec: planned, status: 'running', segStart: Date.now(), before: 0 }));

  useEffect(() => { run ? localStorage.setItem('sm-focus-run', JSON.stringify(run)) : localStorage.removeItem('sm-focus-run'); }, [run]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const elapsedMs = run ? run.before + (run.status === 'running' ? now - run.segStart : 0) : 0;
  const total = (run?.plannedSec ?? dur[mode] * 60);
  const remaining = Math.max(0, total - Math.floor(elapsedMs / 1000));

  const finish = async () => {
    if (!run || finishing.current) return; finishing.current = true;
    try {
      await patch(run.sessionId, { status: 'completed', ended_at: new Date().toISOString(), duration_seconds: run.plannedSec });
      beep(); setMood('happy'); setTimeout(() => setMood('idle'), 4000);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('StudyMate', { body: run.mode === 'focus' ? 'Sesi fokus selesai. Waktunya istirahat!' : 'Istirahat selesai. Siap fokus lagi?' });
      const n = run.mode === 'focus' ? done + 1 : done;
      setDone(n); setMode(run.mode === 'focus' ? (n % 4 === 0 ? 'long_break' : 'short_break') : 'focus');
      toast(run.mode === 'focus' ? 'Sesi fokus selesai!' : 'Istirahat selesai!'); setRun(null); hist.refetch();
    } catch (e) { toast((e as Error).message, 'error'); } finally { finishing.current = false; }
  };
  useEffect(() => { if (run?.status === 'running' && remaining === 0) finish(); }); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); start.mutate({ mode, planned: dur[mode] * 60 }); };
  const pause = async () => { if (!run) return; try { await patch(run.sessionId, { status: 'paused', duration_seconds: Math.floor(elapsedMs / 1000) }); setRun({ ...run, status: 'paused', before: elapsedMs, segStart: 0 }); } catch (e) { toast((e as Error).message, 'error'); } };
  const resume = async () => { if (!run) return; try { await patch(run.sessionId, { status: 'running' }); setRun({ ...run, status: 'running', segStart: Date.now() }); } catch (e) { toast((e as Error).message, 'error'); } };
  const stop = async () => { if (!run) return; try { await patch(run.sessionId, { status: 'cancelled', ended_at: new Date().toISOString(), duration_seconds: Math.floor(elapsedMs / 1000) }); setRun(null); hist.refetch(); } catch (e) { toast((e as Error).message, 'error'); } };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0'), ss = String(remaining % 60).padStart(2, '0');
  const pct = ((total - remaining) / total) * 100;
  const faceMood: Mood = mood === 'happy' ? 'happy' : run?.status === 'running' && run.mode === 'focus' ? 'focus' : 'idle';

  return (
    <>
      <PageHead title="Focus Mode" icon="timer"><Button variant="alt" icon="gear" onClick={() => setCfg(true)}>Durasi</Button></PageHead>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel tone="soft">
          <div className="mb-4 flex flex-wrap justify-center">
            {(Object.keys(LABEL) as Mode[]).map((m) => <Button key={m} sm variant={(run?.mode ?? mode) === m ? 'gold' : 'alt'} disabled={!!run} onClick={() => setMode(m)}>{LABEL[m]}</Button>)}
          </div>
          <div className="grid place-items-center gap-4 py-2">
            <Mate size={128} mood={faceMood} bob={run?.status === 'running'} />
            <p className="font-pixel text-4xl text-primary sm:text-5xl" role="timer" aria-live="off">{mm}:{ss}</p>
            <div className="w-full max-w-md"><Bar value={pct} color="var(--gold)" label="Progres sesi" /></div>
            {run && <p className="text-sm text-muted">{run.status === 'paused' ? 'Dijeda' : 'Berjalan'} · {LABEL[run.mode]}</p>}
          </div>
          {!run && mode === 'focus' && (
            <Field label="Mengerjakan tugas (opsional)"><select className="px-in" value={task} onChange={(e) => setTask(e.target.value)}><option value="">Tanpa tugas</option>{tasks.data?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
          )}
          <div className="flex flex-wrap justify-center">
            {!run && <Button icon="play" variant="grass" onClick={begin} disabled={start.isPending}>Mulai</Button>}
            {run?.status === 'running' && <Button icon="pause" variant="gold" onClick={pause}>Jeda</Button>}
            {run?.status === 'paused' && <Button icon="play" variant="grass" onClick={resume}>Lanjut</Button>}
            {run && <Button icon="x" variant="danger" onClick={stop}>Akhiri</Button>}
          </div>
          <p className="mt-3 text-center text-sm text-muted">Sesi fokus selesai hari ini: {done}. Istirahat panjang setelah 4 sesi.</p>
        </Panel>

        <Panel title="Riwayat sesi" icon="clock">
          {hist.items.length === 0 ? <p className="text-muted">Belum ada sesi.</p> : <ul className="space-y-2">{hist.items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm"><span>{LABEL[s.session_type]}<br /><span className="text-muted">{fmt(s.started_at, 'd MMM, HH:mm')}</span></span>
              <span className="text-right"><Tag color={s.status === 'completed' ? '#B6E3C8' : s.status === 'cancelled' ? '#F2B6B6' : undefined}>{s.status === 'completed' ? 'Selesai' : s.status === 'cancelled' ? 'Dihentikan' : s.status === 'paused' ? 'Dijeda' : 'Berjalan'}</Tag><br />{Math.round(s.duration_seconds / 60)} mnt</span></li>))}
            {hist.hasNextPage && <li><Button sm variant="alt" onClick={() => hist.fetchNextPage()}>Muat lagi</Button></li>}</ul>}
        </Panel>
      </div>
      {cfg && <DurForm dur={dur} onClose={() => setCfg(false)} onSave={(d) => { setDur(d); localStorage.setItem('sm-focus-dur', JSON.stringify(d)); setCfg(false); }} />}
    </>
  );
}

function DurForm({ dur, onSave, onClose }: { dur: Record<Mode, number>; onSave: (d: Record<Mode, number>) => void; onClose: () => void }) {
  const [d, setD] = useState(dur);
  return (
    <Modal title="Atur durasi (menit)" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
        {(Object.keys(LABEL) as Mode[]).map((m) => <Field key={m} label={LABEL[m]}><input className="px-in" type="number" min={1} max={180} required value={d[m]} onChange={(e) => setD({ ...d, [m]: Math.max(1, Math.min(180, Number(e.target.value))) })} /></Field>)}
        <div className="flex justify-between"><Button variant="alt" onClick={() => setD({ focus: 25, short_break: 5, long_break: 15 })}>Bawaan</Button><div><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit">Simpan</Button></div></div>
      </form>
    </Modal>
  );
}
