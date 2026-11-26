import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ColorPick, Confirm, Empty, ErrorBox, Field, Loading, Modal, PageHead, Panel, Tabs, Tag } from '../components/px';
import { api } from '../lib/api';
import { useList, useMut } from '../lib/hooks';
import type { ClassSchedule, Subject } from '../lib/types';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const today = () => new Date().toLocaleDateString('en-CA');

export default function Classes() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState<'week' | 'subjects'>('week');
  const subjects = useList<Subject>('subjects', '/subjects');
  const classes = useList<ClassSchedule>('classes', '/class-schedules');
  const [subj, setSubj] = useState<Partial<Subject> | null>(null);
  const [cls, setCls] = useState<Partial<ClassSchedule> | null>(sp.get('new') ? {} : null);
  const [del, setDel] = useState<{ kind: 'subject' | 'class'; id: string } | null>(null);
  const remove = useMut(({ kind, id }: { kind: string; id: string }) => api(kind === 'subject' ? `/subjects/${id}` : `/class-schedules/${id}`, { method: 'DELETE' }), 'Dihapus');
  const name = (id: string) => subjects.data?.find((s) => s.id === id);

  if (subjects.isLoading || classes.isLoading) return <Loading />;
  if (subjects.error || classes.error) return <ErrorBox error={subjects.error ?? classes.error} retry={() => { subjects.refetch(); classes.refetch(); }} />;

  return (
    <>
      <PageHead title="Kelas" icon="class">
        {tab === 'week' ? <Button icon="plus" onClick={() => (subjects.data?.length ? setCls({}) : setSubj({}))}>Tambah kelas</Button> : <Button icon="plus" onClick={() => setSubj({})}>Tambah mata kuliah</Button>}
      </PageHead>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'week', label: 'Jadwal mingguan', icon: 'calendar' }, { id: 'subjects', label: 'Mata kuliah', icon: 'class' }]} />

      {tab === 'week' && (
        !subjects.data?.length ? <Empty icon="class" title="Mulai dari mata kuliah" hint="Tambahkan mata kuliah dulu, lalu atur jam kelasnya." action={<Button onClick={() => setSubj({})}>Tambah mata kuliah</Button>} /> :
        <div className="grid gap-4 md:grid-cols-2">{ORDER.map((d) => {
          const items = (classes.data ?? []).filter((c) => c.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
          return (
            <Panel key={d} title={DAYS[d]}>
              {items.length === 0 ? <p className="text-muted">Tidak ada kelas.</p> : <ul className="space-y-2">{items.map((c) => {
                const s = name(c.subject_id);
                return (
                  <li key={c.id} className="flex items-center gap-3 p-2 pl-3" style={{ borderLeft: `8px solid ${s?.color ?? '#3988D7'}` }}>
                    <div className="min-w-0 flex-1"><p className="truncate">{s?.name}</p><p className="text-sm text-muted">{c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}{c.room ? ` · ${c.room}` : ''}{(c.lecturer ?? s?.lecturer) ? ` · ${c.lecturer ?? s?.lecturer}` : ''}</p></div>
                    <Button sm variant="alt" icon="edit" aria-label="Ubah" onClick={() => setCls(c)} />
                    <Button sm variant="danger" icon="trash" aria-label="Hapus" onClick={() => setDel({ kind: 'class', id: c.id })} />
                  </li>);
              })}</ul>}
            </Panel>);
        })}</div>
      )}

      {tab === 'subjects' && (
        !subjects.data?.length ? <Empty icon="class" title="Belum ada mata kuliah" action={<Button onClick={() => setSubj({})}>Tambah mata kuliah</Button>} /> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{subjects.data.map((s) => (
          <Panel key={s.id}>
            <div className="mb-2 h-3" style={{ background: s.color ?? '#3988D7' }} />
            <h3 className="mb-1 text-[10px]">{s.name}</h3>
            {s.lecturer && <p className="text-muted">{s.lecturer}</p>}
            {s.description && <p className="mt-1 text-sm">{s.description}</p>}
            <div className="mt-3 flex"><Button sm variant="alt" icon="edit" onClick={() => setSubj(s)}>Ubah</Button><Button sm variant="danger" icon="trash" onClick={() => setDel({ kind: 'subject', id: s.id })}>Hapus</Button></div>
          </Panel>))}</div>
      )}

      {subj && <SubjectForm init={subj} onClose={() => setSubj(null)} />}
      {cls && <ClassForm init={cls} subjects={subjects.data ?? []} onClose={() => setCls(null)} />}
      {del && <Confirm title={del.kind === 'subject' ? 'Hapus mata kuliah?' : 'Hapus kelas?'} text={del.kind === 'subject' ? 'Jadwal kelas mata kuliah ini ikut terhapus. Tugas, catatan, dan materi tetap ada tanpa mata kuliah.' : 'Jadwal kelas dan pengingatnya akan dihapus.'} onYes={() => remove.mutate(del)} onClose={() => setDel(null)} />}
    </>
  );
}

function SubjectForm({ init, onClose }: { init: Partial<Subject>; onClose: () => void }) {
  const [f, setF] = useState({ name: init.name ?? '', lecturer: init.lecturer ?? '', color: init.color ?? '#3988D7', description: init.description ?? '' });
  const save = useMut((b: object) => api(init.id ? `/subjects/${init.id}` : '/subjects', { method: init.id ? 'PUT' : 'POST', body: b }), 'Mata kuliah disimpan', onClose);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate({ name: f.name, lecturer: f.lecturer || null, color: f.color, description: f.description || null, ...(init.id ? { expected_updated_at: init.updated_at } : {}) }); };
  return (
    <Modal title={init.id ? 'Ubah mata kuliah' : 'Mata kuliah baru'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nama mata kuliah"><input className="px-in" required maxLength={150} autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Dosen"><input className="px-in" maxLength={150} value={f.lecturer} onChange={(e) => setF({ ...f, lecturer: e.target.value })} /></Field>
        <p className="mb-1 ml-1 text-sm text-muted">Warna</p><ColorPick value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        <Field label="Catatan tambahan"><textarea className="px-in" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
      </form>
    </Modal>
  );
}

function ClassForm({ init, subjects, onClose }: { init: Partial<ClassSchedule>; subjects: Subject[]; onClose: () => void }) {
  const [f, setF] = useState({
    subject_id: init.subject_id ?? subjects[0]?.id ?? '', day_of_week: init.day_of_week ?? 1, start_time: init.start_time?.slice(0, 5) ?? '08:00', end_time: init.end_time?.slice(0, 5) ?? '09:40',
    room: init.room ?? '', lecturer: init.lecturer ?? '', valid_from: init.valid_from ?? today(), valid_until: init.valid_until ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const save = useMut((b: object) => api(init.id ? `/class-schedules/${init.id}` : '/class-schedules', { method: init.id ? 'PUT' : 'POST', body: b }), 'Kelas disimpan', onClose);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.end_time <= f.start_time) return setErr('Jam selesai harus setelah jam mulai.');
    if (f.valid_until && f.valid_until < f.valid_from) return setErr('Tanggal berakhir tidak boleh sebelum tanggal mulai.');
    setErr(null);
    save.mutate({ ...f, room: f.room || null, lecturer: f.lecturer || null, valid_until: f.valid_until || null, ...(init.id ? { expected_updated_at: init.updated_at } : {}) });
  };
  return (
    <Modal title={init.id ? 'Ubah kelas' : 'Kelas baru'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Mata kuliah"><select className="px-in" required value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Hari"><select className="px-in" value={f.day_of_week} onChange={(e) => setF({ ...f, day_of_week: Number(e.target.value) })}>{ORDER.map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jam mulai"><input className="px-in" type="time" required value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
          <Field label="Jam selesai" error={err}><input className="px-in" type="time" required value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ruangan"><input className="px-in" maxLength={100} value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></Field>
          <Field label="Dosen (opsional)"><input className="px-in" maxLength={150} value={f.lecturer} onChange={(e) => setF({ ...f, lecturer: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Berlaku mulai"><input className="px-in" type="date" required value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></Field>
          <Field label="Berlaku sampai" hint="Kosongkan bila tanpa batas"><input className="px-in" type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
        </div>
        <p className="mb-3 flex items-center text-sm text-muted"><Tag>Mingguan</Tag>Kelas berulang setiap minggu pada hari yang dipilih.</p>
        <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
      </form>
    </Modal>
  );
}
