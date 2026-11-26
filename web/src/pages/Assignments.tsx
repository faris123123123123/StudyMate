import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Check, Confirm, Empty, ErrorBox, Field, Loading, Modal, PageHead, Panel, Tabs, Tag } from '../components/px';
import { api } from '../lib/api';
import { fromInput, relative, toInput } from '../lib/dates';
import { useInfinite, useList, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { Assignment, Priority, Subject, TaskStatus } from '../lib/types';

type View = 'all' | 'active' | 'overdue' | 'completed';
const PRI: Record<Priority, { label: string; color: string }> = { high: { label: 'Tinggi', color: '#F2B6B6' }, medium: { label: 'Sedang', color: '#F8DE9A' }, low: { label: 'Rendah', color: '#B6E3C8' } };
const STAT: Record<TaskStatus, string> = { not_started: 'Belum dimulai', in_progress: 'Dikerjakan', completed: 'Selesai' };

export default function Assignments() {
  const { lang, fmt } = useSettings();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState<View>('active');
  const [priority, setPriority] = useState(''); const [subject, setSubject] = useState(''); const [q, setQ] = useState(''); const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [edit, setEdit] = useState<Partial<Assignment> | null>(sp.get('new') ? {} : null);
  const [del, setDel] = useState<Assignment | null>(null);
  const subjects = useList<Subject>('subjects', '/subjects');

  const query: Record<string, unknown> = { priority, subject_id: subject, q, sort: 'due_at', dir };
  if (view === 'active') query.status_not = 'completed';
  if (view === 'overdue') { query.status_not = 'completed'; query.to = new Date().toISOString(); }
  if (view === 'completed') query.status = 'completed';
  const list = useInfinite<Assignment>('assignments', '/assignments', query);
  const update = useMut(({ id, ...b }: { id: string } & object) => api(`/assignments/${id}`, { method: 'PUT', body: b }));
  const remove = useMut((id: string) => api(`/assignments/${id}`, { method: 'DELETE' }), 'Tugas dihapus');
  const subj = (id: string | null) => subjects.data?.find((s) => s.id === id);
  const isOverdue = (a: Assignment) => a.status !== 'completed' && !!a.due_at && new Date(a.due_at) < new Date();

  return (
    <>
      <PageHead title="Tugas" icon="tasks"><Button icon="plus" onClick={() => setEdit({})}>Tambah tugas</Button></PageHead>
      <Tabs<View> value={view} onChange={setView} items={[{ id: 'active', label: 'Aktif' }, { id: 'overdue', label: 'Terlambat' }, { id: 'completed', label: 'Selesai' }, { id: 'all', label: 'Semua' }]} />
      <div className="mb-4 grid gap-1 sm:grid-cols-4">
        <input className="px-in" placeholder="Cari tugas..." aria-label="Cari tugas" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="px-in" aria-label="Prioritas" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">Semua prioritas</option>{Object.entries(PRI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select className="px-in" aria-label="Mata kuliah" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Semua mata kuliah</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="px-in" aria-label="Urutan" value={dir} onChange={(e) => setDir(e.target.value as 'asc' | 'desc')}><option value="asc">Deadline terdekat</option><option value="desc">Deadline terjauh</option></select>
      </div>

      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : list.items.length === 0 ? (
        <Empty icon="tasks" title={view === 'completed' ? 'Belum ada tugas selesai' : 'Tidak ada tugas'} hint="Tambahkan tugas baru agar deadline tidak terlewat." action={<Button onClick={() => setEdit({})}>Tambah tugas</Button>} />
      ) : (
        <div className="space-y-3">
          {list.items.map((a) => {
            const s = subj(a.subject_id);
            const done = a.status === 'completed';
            return (
              <Panel key={a.id} className={done ? 'opacity-70' : ''}>
                <div className="flex items-start gap-3">
                  <Check checked={done} label={`Tandai ${a.title} selesai`} onChange={() => update.mutate({ id: a.id, status: done ? 'not_started' : 'completed' })} />
                  <div className="min-w-0 flex-1">
                    <p className={`break-words ${done ? 'line-through' : ''}`}>{a.title}</p>
                    <div className="flex flex-wrap items-center">
                      {s && <Tag color={s.color ?? undefined} dark>{s.name}</Tag>}
                      <Tag color={PRI[a.priority].color}>{PRI[a.priority].label}</Tag>
                      {a.due_at && <Tag>{fmt(a.due_at, 'd MMM, HH:mm')}{!done && ` · ${relative(a.due_at, lang)}`}</Tag>}
                      {isOverdue(a) && <Tag color="#D94F4F" dark>Terlambat</Tag>}
                    </div>
                    {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                  </div>
                  <div className="flex flex-col items-end sm:flex-row">
                    <select className="px-in !w-auto text-sm" aria-label="Status" value={a.status} onChange={(e) => update.mutate({ id: a.id, status: e.target.value })}>{Object.entries(STAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <Button sm variant="alt" icon="edit" aria-label="Ubah" onClick={() => setEdit(a)} />
                    <Button sm variant="danger" icon="trash" aria-label="Hapus" onClick={() => setDel(a)} />
                  </div>
                </div>
              </Panel>);
          })}
          {list.hasNextPage && <div className="text-center"><Button variant="alt" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Muat lagi ({list.items.length}/{list.total})</Button></div>}
        </div>
      )}
      {edit && <Form init={edit} subjects={subjects.data ?? []} onClose={() => { setEdit(null); if (sp.get('new')) setSp({}); }} />}
      {del && <Confirm title="Hapus tugas?" text={`"${del.title}" dan pengingatnya akan dihapus.`} onYes={() => remove.mutate(del.id)} onClose={() => setDel(null)} />}
    </>
  );
}

function Form({ init, subjects, onClose }: { init: Partial<Assignment>; subjects: Subject[]; onClose: () => void }) {
  const { tz } = useSettings();
  const [f, setF] = useState({
    title: init.title ?? '', description: init.description ?? '', subject_id: init.subject_id ?? '', priority: (init.priority ?? 'medium') as Priority,
    status: (init.status ?? 'not_started') as TaskStatus, due: init.due_at ? toInput(init.due_at, tz) : '',
  });
  const save = useMut((b: object) => api(init.id ? `/assignments/${init.id}` : '/assignments', { method: init.id ? 'PUT' : 'POST', body: b }), 'Tugas disimpan', onClose);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ title: f.title, description: f.description || null, subject_id: f.subject_id || null, priority: f.priority, status: f.status, due_at: f.due ? fromInput(f.due, tz) : null, ...(init.id ? { expected_updated_at: init.updated_at } : {}) });
  };
  return (
    <Modal title={init.id ? 'Ubah tugas' : 'Tugas baru'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Judul tugas"><input className="px-in" required maxLength={200} autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Mata kuliah"><select className="px-in" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Prioritas"><select className="px-in" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>{Object.entries(PRI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Status"><select className="px-in" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TaskStatus })}>{Object.entries(STAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="Deadline (opsional)"><input className="px-in" type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Deskripsi"><textarea className="px-in" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
      </form>
    </Modal>
  );
}
