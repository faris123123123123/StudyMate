import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Confirm, Empty, ErrorBox, Loading, Panel, PixelIcon, cx, useToast } from '../components/px';
import { api, ApiError } from '../lib/api';
import { useInfinite, useList, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { Note, Subject } from '../lib/types';

type Draft = { title: string; content: string; subject_id: string };

export default function Notes() {
  const { fmt } = useSettings();
  const { toast } = useToast();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(''); const [subject, setSubject] = useState('');
  const [sel, setSel] = useState<Note | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: '', content: '', subject_id: '' });
  const [dirty, setDirty] = useState(false); const [state, setState] = useState<'saved' | 'saving' | 'conflict' | 'error'>('saved');
  const [del, setDel] = useState(false);
  const version = useRef<string>(''); const timer = useRef<ReturnType<typeof setTimeout>>();
  const subjects = useList<Subject>('subjects', '/subjects');
  const list = useInfinite<Note>('notes', '/notes', { q, subject_id: subject });
  const create = useMut(() => api<Note>('/notes', { method: 'POST', body: { title: 'Catatan baru', content: '' } }), undefined, (n) => open(n, true));
  const remove = useMut((id: string) => api(`/notes/${id}`, { method: 'DELETE' }), 'Catatan dihapus', () => { setSel(null); setDirty(false); });

  const save = async (n = sel, d = draft) => {
    if (!n) return true;
    setState('saving');
    try {
      const row = await api<Note>(`/notes/${n.id}`, { method: 'PUT', body: { title: d.title.trim() || 'Tanpa judul', content: d.content, subject_id: d.subject_id || null, expected_updated_at: version.current } });
      version.current = row.updated_at; setSel(row); setDirty(false); setState('saved'); list.refetch();
      return true;
    } catch (e) {
      setState(e instanceof ApiError && e.status === 409 ? 'conflict' : 'error');
      toast((e as Error).message, 'error');
      return false;
    }
  };

  // Simpan otomatis 1,5 dtk setelah berhenti mengetik
  useEffect(() => {
    if (!dirty || state === 'conflict') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1500);
    return () => clearTimeout(timer.current);
  }, [draft, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (n: Note) => { setSel(n); version.current = n.updated_at; setDraft({ title: n.title, content: n.content ?? '', subject_id: n.subject_id ?? '' }); setDirty(false); setState('saved'); };
  /** Perubahan belum tersimpan disimpan dulu sebelum pindah catatan, sehingga tidak ada konten yang hilang. */
  const open = async (n: Note, force = false) => { if (!force && dirty && !(await save())) return; load(n); };
  const reload = async () => { if (!sel) return; const fresh = await api<Note>(`/notes/${sel.id}`); load(fresh); list.refetch(); };
  const edit = (p: Partial<Draft>) => { setDraft({ ...draft, ...p }); setDirty(true); if (state !== 'conflict') setState('saved'); };

  useEffect(() => { if (sp.get('new')) { create.mutate(undefined); setSp({}); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const status = state === 'saving' ? 'Menyimpan...' : state === 'conflict' ? 'Konflik' : state === 'error' ? 'Gagal menyimpan' : dirty ? 'Belum disimpan' : sel ? `Tersimpan · ${fmt(sel.updated_at, 'HH:mm')}` : '';

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className={cx(sel && 'hidden md:block')}>
        <div className="mb-3 flex items-center justify-between"><h1 className="flex items-center gap-2 text-sm text-primary"><PixelIcon name="note" size={24} />Catatan</h1><Button icon="plus" sm onClick={() => create.mutate(undefined)} disabled={create.isPending}>Baru</Button></div>
        <input className="px-in" placeholder="Cari catatan..." aria-label="Cari catatan" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="px-in" aria-label="Mata kuliah" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Semua mata kuliah</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : list.items.length === 0 ? <Empty icon="note" title="Belum ada catatan" hint="Tekan Baru untuk mulai menulis." /> : (
          <ul className="mt-3 space-y-2">{list.items.map((n) => (
            <li key={n.id}><button onClick={() => open(n)} className={cx('px w-full p-3 text-left', sel?.id === n.id && '!bg-gold !text-[#2b1d00]')}>
              <p className="truncate">{n.title}</p><p className="text-xs opacity-70">{fmt(n.updated_at, 'd MMM yyyy, HH:mm')}</p></button></li>))}
            {list.hasNextPage && <li className="text-center"><Button sm variant="alt" onClick={() => list.fetchNextPage()}>Muat lagi</Button></li>}</ul>)}
      </div>

      <div className={cx(!sel && 'hidden md:block')}>
        {!sel ? <Panel><Empty icon="note" title="Pilih atau buat catatan" /></Panel> : (
          <Panel>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button sm variant="alt" icon="left" className="md:!hidden" onClick={async () => { if (!dirty || (await save())) setSel(null); }}>Daftar</Button>
              <span className={cx('flex-1 text-sm', state === 'conflict' || state === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">{status}</span>
              {state === 'conflict' && <Button sm variant="gold" onClick={reload}>Muat versi terbaru</Button>}
              <Button sm icon="check" onClick={() => save()} disabled={!dirty || state === 'conflict'}>Simpan</Button>
              <Button sm variant="danger" icon="trash" aria-label="Hapus catatan" onClick={() => setDel(true)} />
            </div>
            <input className="px-in font-pixel !text-[12px]" aria-label="Judul" maxLength={200} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
            <select className="px-in" aria-label="Mata kuliah catatan" value={draft.subject_id} onChange={(e) => edit({ subject_id: e.target.value })}><option value="">Tanpa mata kuliah</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <textarea className="px-in min-h-[50vh]" aria-label="Isi catatan" placeholder="Tulis catatanmu di sini..." value={draft.content} onChange={(e) => edit({ content: e.target.value })} />
          </Panel>
        )}
      </div>
      {del && sel && <Confirm title="Hapus catatan?" text={`"${sel.title}" akan dihapus permanen.`} onYes={() => remove.mutate(sel.id)} onClose={() => setDel(false)} />}
    </div>
  );
}
