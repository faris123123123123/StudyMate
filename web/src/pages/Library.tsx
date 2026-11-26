import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Confirm, Empty, ErrorBox, Field, Loading, Modal, PageHead, Panel, PixelIcon, Tag, useToast, type IconName } from '../components/px';
import { api, upload } from '../lib/api';
import { formatBytes } from '../lib/dates';
import { useInfinite, useList, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { Folder, Material, Subject } from '../lib/types';

const EXT = ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'jpg', 'jpeg', 'png'];
const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 25);
const ICON: Record<string, IconName> = { pdf: 'file', docx: 'note', pptx: 'chart', xlsx: 'tasks', txt: 'note', jpg: 'eye', jpeg: 'eye', png: 'eye' };
const STATUS: Record<string, string> = { uploading: 'Mengunggah', ready: 'Siap', failed: 'Gagal' };

interface Job { id: number; name: string; pct: number; error?: string }

export default function Library() {
  const { fmt } = useSettings();
  const { toast } = useToast();
  const [sp] = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [sort, setSort] = useState('created_at'); const [dir, setDir] = useState('desc'); const [subject, setSubject] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]); const [drag, setDrag] = useState(false);
  const [modal, setModal] = useState<null | { kind: 'folder'; folder?: Folder } | { kind: 'rename' | 'move' | 'preview'; file: Material }>(null);
  const [del, setDel] = useState<null | { kind: 'file'; m: Material } | { kind: 'folder'; f: Folder }>(null);

  const folders = useList<Folder>('folders', '/study-folders');
  const subjects = useList<Subject>('subjects', '/subjects');
  const files = useInfinite<Material>('materials', '/materials', { folder_id: folderId ?? 'null', q, sort, dir, subject_id: subject });
  const removeFile = useMut((id: string) => api(`/materials/${id}`, { method: 'DELETE' }), 'File dihapus');
  const removeFolder = useMut((id: string) => api(`/study-folders/${id}`, { method: 'DELETE' }), 'Folder dihapus', () => setFolderId(null));

  const all = folders.data ?? [];
  const crumbs = useMemo(() => { const out: Folder[] = []; let cur = all.find((f) => f.id === folderId); while (cur) { out.unshift(cur); cur = all.find((f) => f.id === cur!.parent_folder_id); } return out; }, [all, folderId]);
  const subFolders = all.filter((f) => (f.parent_folder_id ?? null) === folderId);

  useEffect(() => { if (sp.get('upload')) fileInput.current?.click(); }, [sp]);

  const send = async (list: FileList | File[]) => {
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      const idx = Date.now() + Math.random();
      const set = (p: Partial<Job>) => setJobs((j) => j.map((x) => (x.id === idx ? { ...x, ...p } : x)));
      setJobs((j) => [...j, { id: idx, name: f.name, pct: 0 }]);
      if (!EXT.includes(ext)) { set({ error: 'Format tidak didukung' }); continue; }
      if (f.size > MAX_MB * 1048576) { set({ error: `Melebihi ${MAX_MB} MB` }); continue; }
      const form = new FormData();
      form.append('file', f);
      if (folderId) form.append('folder_id', folderId);
      try { await upload('/materials', form, (pct) => set({ pct })); set({ pct: 100 }); files.refetch(); }
      catch (e) { set({ error: (e as Error).message }); toast((e as Error).message, 'error'); }
    }
    setTimeout(() => setJobs((j) => j.filter((x) => x.error)), 2500);
  };

  const download = async (m: Material) => { try { const r = await api<Material>(`/materials/${m.id}`, { query: { download: 1 } }); window.open(r.signed_url, '_blank'); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <>
      <PageHead title="Study Library" icon="folder">
        <Button variant="alt" icon="plus" onClick={() => setModal({ kind: 'folder' })}>Folder baru</Button>
        <Button icon="upload" onClick={() => fileInput.current?.click()}>Unggah file</Button>
        <input ref={fileInput} type="file" multiple hidden accept={EXT.map((e) => `.${e}`).join(',')} onChange={(e) => { if (e.target.files) send(e.target.files); e.target.value = ''; }} />
      </PageHead>

      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm" aria-label="Lokasi folder">
        <button className="text-secondary underline" onClick={() => setFolderId(null)}>Pustaka</button>
        {crumbs.map((c) => <span key={c.id} className="flex items-center gap-1"><PixelIcon name="right" size={10} /><button className="text-secondary underline" onClick={() => setFolderId(c.id)}>{c.name}</button></span>)}
      </nav>

      <div className="mb-3 grid gap-1 sm:grid-cols-4">
        <input className="px-in sm:col-span-2" placeholder="Cari file..." aria-label="Cari file" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="px-in" aria-label="Urutkan" value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); setSort(s); setDir(d); }}>
          <option value="created_at:desc">Terbaru</option><option value="created_at:asc">Terlama</option><option value="file_name:asc">Nama A–Z</option><option value="file_size:desc">Terbesar</option>
        </select>
        <select className="px-in" aria-label="Mata kuliah" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Semua mata kuliah</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>

      <div className={`px mb-4 grid place-items-center p-5 text-center ${drag ? 'px-soft' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}>
        <PixelIcon name="upload" size={28} className="text-secondary" />
        <p>Tarik file ke sini atau pakai tombol unggah.</p>
        <p className="text-sm text-muted">PDF, DOCX, PPTX, XLSX, TXT, JPG, PNG · maks. {MAX_MB} MB</p>
      </div>

      {jobs.length > 0 && <Panel className="mb-4" title="Unggahan">{jobs.map((j) => (
        <div key={j.id} className="mb-2"><p className="flex justify-between text-sm"><span className="truncate">{j.name}</span><span className={j.error ? 'text-danger' : ''}>{j.error ?? `${j.pct}%`}</span></p>
          {!j.error && <div className="px-bar"><i style={{ width: `${j.pct}%` }} /></div>}</div>))}</Panel>}

      {subFolders.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{subFolders.map((f) => (
        <Panel key={f.id}><div className="flex items-center gap-2">
          <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setFolderId(f.id)}><PixelIcon name="folder" size={24} className="text-gold" /><span className="truncate">{f.name}</span></button>
          <Button sm variant="alt" icon="edit" aria-label="Ubah folder" onClick={() => setModal({ kind: 'folder', folder: f })} />
          <Button sm variant="danger" icon="trash" aria-label="Hapus folder" onClick={() => setDel({ kind: 'folder', f })} />
        </div></Panel>))}</div>}

      {files.isLoading ? <Loading /> : files.error ? <ErrorBox error={files.error} retry={() => files.refetch()} /> : files.items.length === 0 ? (
        <Empty icon="folder" title="Belum ada file di sini" hint="Unggah materi kuliah supaya mudah dibuka dari perangkat mana saja." />
      ) : (
        <div className="space-y-3">{files.items.map((m) => (
          <Panel key={m.id}><div className="flex flex-wrap items-center gap-3">
            <PixelIcon name={ICON[m.file_type] ?? 'file'} size={28} className="text-secondary" />
            <div className="min-w-0 flex-1"><p className="truncate">{m.file_name}</p><p className="text-sm text-muted">{formatBytes(Number(m.file_size))} · {fmt(m.created_at, 'd MMM yyyy')} <Tag color={m.processing_status === 'failed' ? '#F2B6B6' : m.processing_status === 'ready' ? '#B6E3C8' : undefined}>{STATUS[m.processing_status]}</Tag></p></div>
            <div className="flex flex-wrap">
              <Button sm variant="alt" icon="eye" aria-label="Pratinjau" disabled={m.processing_status !== 'ready'} onClick={() => setModal({ kind: 'preview', file: m })} />
              <Button sm variant="alt" icon="download" aria-label="Unduh" disabled={m.processing_status !== 'ready'} onClick={() => download(m)} />
              <Button sm variant="alt" icon="edit" aria-label="Ganti nama" onClick={() => setModal({ kind: 'rename', file: m })} />
              <Button sm variant="alt" icon="folder" aria-label="Pindahkan" onClick={() => setModal({ kind: 'move', file: m })} />
              <Button sm variant="danger" icon="trash" aria-label="Hapus" onClick={() => setDel({ kind: 'file', m })} />
            </div></div></Panel>))}
          {files.hasNextPage && <div className="text-center"><Button variant="alt" onClick={() => files.fetchNextPage()}>Muat lagi ({files.items.length}/{files.total})</Button></div>}
        </div>
      )}

      {modal?.kind === 'folder' && <FolderForm folder={modal.folder} parent={folderId} subjects={subjects.data ?? []} onClose={() => setModal(null)} />}
      {modal?.kind === 'rename' && <Rename file={modal.file} onClose={() => setModal(null)} />}
      {modal?.kind === 'move' && <Move file={modal.file} folders={all} onClose={() => setModal(null)} />}
      {modal?.kind === 'preview' && <Preview file={modal.file} onClose={() => setModal(null)} onDownload={() => download(modal.file)} />}
      {del?.kind === 'file' && <Confirm title="Hapus file?" text={`"${del.m.file_name}" akan dihapus permanen dari penyimpanan.`} onYes={() => removeFile.mutate(del.m.id)} onClose={() => setDel(null)} />}
      {del?.kind === 'folder' && <Confirm title="Hapus folder?" text="Subfolder ikut terhapus. File di dalamnya tidak dihapus, tetapi dipindah ke tingkat teratas Pustaka." onYes={() => removeFolder.mutate(del.f.id)} onClose={() => setDel(null)} />}
    </>
  );
}

function FolderForm({ folder, parent, subjects, onClose }: { folder?: Folder; parent: string | null; subjects: Subject[]; onClose: () => void }) {
  const [name, setName] = useState(folder?.name ?? ''); const [sid, setSid] = useState(folder?.subject_id ?? '');
  const save = useMut((b: object) => api(folder ? `/study-folders/${folder.id}` : '/study-folders', { method: folder ? 'PUT' : 'POST', body: b }), 'Folder disimpan', onClose);
  return (
    <Modal title={folder ? 'Ubah folder' : 'Folder baru'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate({ name, subject_id: sid || null, ...(folder ? { expected_updated_at: folder.updated_at } : { parent_folder_id: parent }) }); }}>
        <Field label="Nama folder"><input className="px-in" required autoFocus maxLength={150} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Mata kuliah (opsional)"><select className="px-in" value={sid} onChange={(e) => setSid(e.target.value)}><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
      </form>
    </Modal>
  );
}

function Rename({ file, onClose }: { file: Material; onClose: () => void }) {
  const [name, setName] = useState(file.file_name);
  const save = useMut(() => api(`/materials/${file.id}`, { method: 'PUT', body: { file_name: name, expected_updated_at: file.updated_at } }), 'Nama diperbarui', onClose);
  return (
    <Modal title="Ganti nama file" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Field label="Nama file"><input className="px-in" required autoFocus maxLength={255} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button type="submit" disabled={save.isPending}>Simpan</Button></div>
      </form>
    </Modal>
  );
}

function Move({ file, folders, onClose }: { file: Material; folders: Folder[]; onClose: () => void }) {
  const [to, setTo] = useState(file.folder_id ?? '');
  const save = useMut(() => api(`/materials/${file.id}`, { method: 'PUT', body: { file_name: file.file_name, folder_id: to || null } }), 'File dipindahkan', onClose);
  return (
    <Modal title="Pindahkan file" onClose={onClose}>
      <Field label="Folder tujuan"><select className="px-in" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Pustaka (teratas)</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
      <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>Pindahkan</Button></div>
    </Modal>
  );
}

function Preview({ file, onClose, onDownload }: { file: Material; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null); const [text, setText] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const kind = file.file_type === 'pdf' ? 'pdf' : file.file_type === 'txt' ? 'txt' : ['jpg', 'jpeg', 'png'].includes(file.file_type) ? 'img' : 'none';
  useEffect(() => {
    if (kind === 'none') return;
    api<Material>(`/materials/${file.id}`).then(async (r) => { setUrl(r.signed_url!); if (kind === 'txt') setText(await fetch(r.signed_url!).then((x) => x.text())); }).catch((e) => setErr(e.message));
  }, [file.id, kind]);
  return (
    <Modal title={file.file_name} onClose={onClose} wide>
      {err ? <p className="text-danger">{err}</p> : kind === 'none' ? (
        <Empty icon="file" title="Pratinjau belum tersedia" hint="Pratinjau DOCX, PPTX, dan XLSX belum didukung. Unduh file untuk membukanya." action={<Button icon="download" onClick={onDownload}>Unduh</Button>} />
      ) : !url ? <Loading /> : kind === 'pdf' ? <iframe src={url} title={file.file_name} className="h-[70vh] w-full bg-white" /> :
        kind === 'img' ? <img src={url} alt={file.file_name} className="mx-auto max-h-[70vh]" /> : <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-2 text-sm">{text}</pre>}
    </Modal>
  );
}
