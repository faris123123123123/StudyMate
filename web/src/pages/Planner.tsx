import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ColorPick, Confirm, Empty, ErrorBox, Field, Modal, PageHead, Tabs, Tag } from '../components/px';
import { api } from '../lib/api';
import { addDaysStr, addMonthsStr, dayKey, dayStartIso, fromInput, labelOfDay, startOfMonthStr, startOfWeekStr, toInput } from '../lib/dates';
import { useList, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { Category, PlannerEvent, Schedule, Subject } from '../lib/types';

const CATS: Record<Category, { label: string; color: string }> = {
  class: { label: 'Kelas', color: '#3988D7' }, self_study: { label: 'Belajar mandiri', color: '#3FA86B' },
  assignment: { label: 'Tugas', color: '#F2B63D' }, exam: { label: 'Persiapan ujian', color: '#D94F4F' }, personal: { label: 'Pribadi', color: '#8A5CCF' },
};
type View = 'day' | 'week' | 'month';

export default function Planner() {
  const { tz, lang, fmt } = useSettings();
  const [sp, setSp] = useSearchParams();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState<View>('week');
  const [edit, setEdit] = useState<Partial<Schedule> | null>(sp.get('new') ? {} : null);

  const { first, count } = useMemo(() => {
    if (view === 'day') return { first: cursor, count: 1 };
    if (view === 'week') return { first: startOfWeekStr(cursor), count: 7 };
    const f = startOfWeekStr(startOfMonthStr(cursor));
    return { first: f, count: 42 };
  }, [view, cursor]);
  const from = dayStartIso(first, tz), to = dayStartIso(addDaysStr(first, count), tz);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['planner', from, to], queryFn: () => api<{ data: PlannerEvent[] }>('/planner', { query: { from, to } }).then((r) => r.data) });

  const byDay = useMemo(() => {
    const m = new Map<string, PlannerEvent[]>();
    for (const e of data ?? []) { const k = dayKey(e.start_at, tz); m.set(k, [...(m.get(k) ?? []), e]); }
    return m;
  }, [data, tz]);

  const step = (n: number) => setCursor(view === 'month' ? addMonthsStr(cursor, n) : addDaysStr(cursor, n * (view === 'week' ? 7 : 1)));
  const title = view === 'month' ? labelOfDay(cursor, 'MMMM yyyy', lang) : view === 'week' ? `${labelOfDay(first, 'd MMM', lang)} – ${labelOfDay(addDaysStr(first, 6), 'd MMM yyyy', lang)}` : labelOfDay(cursor, 'EEEE, d MMMM yyyy', lang);
  const open = (e: PlannerEvent) => e.kind === 'schedule' && setEdit(e as unknown as Schedule);
  const chip = (e: PlannerEvent) => (
    <button key={e.id} onClick={() => open(e)} className="mb-1 block w-full truncate px-2 py-1 text-left text-sm text-white" style={{ background: e.color ?? CATS[e.category].color, cursor: e.kind === 'schedule' ? 'pointer' : 'default' }} title={e.title}>
      {fmt(e.start_at, 'HH:mm')} {e.title}
    </button>
  );
  const newOn = (day: string) => setEdit({ start_at: fromInput(`${day}T${String(Math.min(23, new Date().getHours() + 1)).padStart(2, '0')}:00`, tz) });

  return (
    <>
      <PageHead title="Study Planner" icon="calendar"><Button icon="plus" onClick={() => newOn(cursor)}>Tambah jadwal</Button></PageHead>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs<View> value={view} onChange={setView} items={[{ id: 'day', label: 'Harian' }, { id: 'week', label: 'Mingguan' }, { id: 'month', label: 'Bulanan' }]} />
        <div className="flex items-center">
          <Button sm variant="alt" icon="left" aria-label="Sebelumnya" onClick={() => step(-1)} />
          <Button sm variant="alt" onClick={() => setCursor(today)}>Hari ini</Button>
          <Button sm variant="alt" icon="right" aria-label="Berikutnya" onClick={() => step(1)} />
        </div>
      </div>
      <h2 className="mb-4 text-[11px] text-primary">{title}</h2>
      {error ? <ErrorBox error={error} retry={refetch} /> : isLoading ? <div className="loader" /> : (
        <>
          {view === 'day' && (
            <div className="px p-4">{(byDay.get(cursor) ?? []).length === 0 ? <Empty icon="calendar" title="Hari ini kosong" hint="Tambahkan jadwal untuk hari ini." /> : (
              <ul className="space-y-2">{(byDay.get(cursor) ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 p-2 pl-3" style={{ borderLeft: `8px solid ${e.color ?? CATS[e.category].color}` }}>
                  <div className="min-w-0 flex-1">{chip(e)}<p className="text-sm text-muted">{fmt(e.start_at, 'HH:mm')}–{fmt(e.end_at, 'HH:mm')}{e.room ? ` · ${e.room}` : ''}</p></div>
                  <Tag>{CATS[e.category].label}</Tag>
                  {e.kind === 'class' && <Link to="/app/classes" className="text-sm text-secondary underline">Atur</Link>}
                </li>))}</ul>)}</div>
          )}
          {view === 'week' && (
            <div className="grid gap-3 md:grid-cols-7">{Array.from({ length: 7 }, (_, i) => addDaysStr(first, i)).map((d) => (
              <div key={d} className={`px p-2 ${d === today ? 'px-soft' : ''}`}>
                <button className="mb-2 w-full text-left text-sm font-bold" onClick={() => { setCursor(d); setView('day'); }}>{labelOfDay(d, 'EEE d', lang)}</button>
                {(byDay.get(d) ?? []).map(chip)}
                <button className="w-full text-left text-xs text-muted hover:text-text" onClick={() => newOn(d)}>+ tambah</button>
              </div>))}</div>
          )}
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: 7 }, (_, i) => <div key={i} className="text-center text-xs text-muted">{labelOfDay(addDaysStr(first, i), 'EEE', lang)}</div>)}
              {Array.from({ length: 42 }, (_, i) => addDaysStr(first, i)).map((d) => {
                const ev = byDay.get(d) ?? [];
                return (
                  <div key={d} className={`px min-h-[72px] p-1 ${d === today ? 'px-soft' : ''} ${d.slice(0, 7) !== cursor.slice(0, 7) ? 'opacity-50' : ''}`}>
                    <button className="mb-1 text-xs font-bold" onClick={() => { setCursor(d); setView('day'); }}>{d.slice(8)}</button>
                    <div className="hidden sm:block">{ev.slice(0, 2).map(chip)}</div>
                    <div className="flex flex-wrap gap-1 sm:hidden">{ev.slice(0, 4).map((e) => <i key={e.id} className="h-2 w-2" style={{ background: e.color ?? CATS[e.category].color }} />)}</div>
                    {ev.length > 2 && <p className="hidden text-xs text-muted sm:block">+{ev.length - 2} lagi</p>}
                  </div>);
              })}
            </div>
          )}
        </>
      )}
      {edit && <ScheduleForm init={edit} onClose={() => { setEdit(null); if (sp.get('new')) setSp({}); }} />}
    </>
  );
}

function ScheduleForm({ init, onClose }: { init: Partial<Schedule>; onClose: () => void }) {
  const { tz } = useSettings();
  const { data: subjects } = useList<Subject>('subjects', '/subjects');
  const editing = Boolean(init.id);
  const base = init.start_at ?? new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000).toISOString();
  const [f, setF] = useState({
    title: init.title ?? '', category: (init.category ?? 'self_study') as Category, subject_id: init.subject_id ?? '', description: init.description ?? '',
    start: toInput(base, tz), end: toInput(init.end_at ?? new Date(+new Date(base) + 3_600_000).toISOString(), tz), color: init.color ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const save = useMut((body: object) => api(editing ? `/schedules/${init.id}` : '/schedules', { method: editing ? 'PUT' : 'POST', body }), 'Jadwal disimpan', onClose);
  const remove = useMut(() => api(`/schedules/${init.id}`, { method: 'DELETE' }), 'Jadwal dihapus', onClose);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (fromInput(f.end, tz) <= fromInput(f.start, tz)) return setErr('Waktu selesai harus setelah waktu mulai.');
    setErr(null);
    save.mutate({
      title: f.title, category: f.category, subject_id: f.subject_id || null, description: f.description || null,
      start_at: fromInput(f.start, tz), end_at: fromInput(f.end, tz), color: f.color || null,
      ...(editing ? { expected_updated_at: init.updated_at } : {}),
    });
  };
  return (
    <Modal title={editing ? 'Ubah jadwal' : 'Jadwal baru'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Judul"><input className="px-in" required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Kategori"><select className="px-in" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Mata kuliah (opsional)"><select className="px-in" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}><option value="">—</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mulai"><input className="px-in" type="datetime-local" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Selesai" error={err}><input className="px-in" type="datetime-local" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        </div>
        <p className="mb-1 ml-1 text-sm text-muted">Warna</p>
        <ColorPick value={f.color || CATS[f.category].color} onChange={(c) => setF({ ...f, color: c })} />
        <Field label="Deskripsi"><textarea className="px-in" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <p className="mb-3 text-sm text-muted">Kelas yang berulang tiap minggu diatur di menu Kelas.</p>
        <div className="flex items-center justify-between">
          {editing ? <Button variant="danger" icon="trash" onClick={() => setDel(true)}>Hapus</Button> : <span />}
          <div><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
        </div>
      </form>
      {del && <Confirm title="Hapus jadwal?" text="Jadwal dan pengingatnya akan dihapus." onYes={() => remove.mutate(undefined)} onClose={() => setDel(false)} />}
    </Modal>
  );
}
