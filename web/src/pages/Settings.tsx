import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mate } from '../components/mate';
import { Button, Field, Loading, Modal, PageHead, Panel, Tabs, useToast } from '../components/px';
import { api, upload } from '../lib/api';
import { passwordError } from '../lib/auth';
import { useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { enablePush } from './Notifications';

type Tab = 'profile' | 'look' | 'notif' | 'account';
const FALLBACK_TZ = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC', 'Europe/London', 'America/New_York'];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <>
      <PageHead title="Pengaturan" icon="gear" />
      <Tabs<Tab> value={tab} onChange={setTab} items={[{ id: 'profile', label: 'Profil', icon: 'user' }, { id: 'look', label: 'Tampilan', icon: 'star' }, { id: 'notif', label: 'Notifikasi', icon: 'bell' }, { id: 'account', label: 'Akun', icon: 'logout' }]} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'look' && <LookTab />}
      {tab === 'notif' && <NotifTab />}
      {tab === 'account' && <AccountTab />}
    </>
  );
}

function ProfileTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pwErr, setPwErr] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const save = useMut((full_name: string) => api('/profile', { method: 'PUT', body: { full_name } }), 'Profil disimpan');
  if (!me) return <Loading />;

  const avatar = async (f: File) => {
    const form = new FormData(); form.append('file', f);
    try { setPct(0); await upload('/profile/avatar', form, setPct); qc.invalidateQueries({ queryKey: ['profile'] }); toast('Foto profil diperbarui'); } catch (e) { toast((e as Error).message, 'error'); } finally { setPct(null); }
  };
  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${location.origin}/login` });
    error ? toast(error.message, 'error') : toast('Cek email baru kamu untuk verifikasi. Email lama tetap dipakai sampai diverifikasi.'); setEmail('');
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    const pe = passwordError(pw); if (pe) return setPwErr(pe);
    setPwErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    error ? toast(error.message, 'error') : toast('Password diperbarui'); setPw('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Profil" icon="user">
        <div className="mb-4 flex items-center gap-4">
          {me.avatar_signed_url ? <img src={me.avatar_signed_url} alt="Foto profil" className="h-20 w-20 object-cover" style={{ imageRendering: 'pixelated', boxShadow: '0 0 0 4px var(--line)' }} /> : <Mate size={80} bob={false} />}
          <div><Button sm variant="alt" icon="upload" onClick={() => file.current?.click()}>Ganti foto</Button><p className="text-sm text-muted">PNG atau JPG, maks. 2 MB{pct !== null && ` · ${pct}%`}</p>
            <input ref={file} type="file" hidden accept="image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) avatar(f); e.target.value = ''; }} /></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(name ?? me.full_name); }}>
          <Field label="Nama lengkap"><input className="px-in" required maxLength={100} value={name ?? me.full_name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button type="submit" disabled={save.isPending}>Simpan profil</Button>
        </form>
      </Panel>
      <div className="space-y-4">
        <Panel title="Email" icon="note">
          <p className="mb-2 text-sm text-muted">Saat ini: {me.email}</p>
          <form onSubmit={changeEmail}><Field label="Email baru"><input className="px-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Button type="submit" variant="alt">Kirim verifikasi</Button></form>
        </Panel>
        <Panel title="Password" icon="gear">
          <form onSubmit={changePw}><Field label="Password baru" error={pwErr} hint="Minimal 8 karakter, huruf besar, huruf kecil, dan angka."><input className="px-in" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field><Button type="submit" variant="alt">Ubah password</Button></form>
        </Panel>
      </div>
    </div>
  );
}

function LookTab() {
  const { settings, update, theme, lang, tz } = useSettings();
  const { toast } = useToast();
  const zones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? FALLBACK_TZ;
  const set = (p: object) => update(p).then(() => toast('Pengaturan disimpan')).catch((e) => toast(e.message, 'error'));
  if (!settings) return <Loading />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Tema" icon="star">
        <div className="flex flex-wrap">{(['light', 'dark'] as const).map((t) => <Button key={t} variant={theme === t ? 'gold' : 'alt'} onClick={() => set({ theme: t })}>{t === 'light' ? 'Terang' : 'Gelap'}</Button>)}</div>
        <div className="mt-4 grid place-items-center"><Mate size={80} mood="happy" /></div>
      </Panel>
      <Panel title="Bahasa dan zona waktu" icon="clock">
        <Field label="Bahasa"><select className="px-in" value={lang} onChange={(e) => set({ language: e.target.value })}><option value="id">Indonesia</option><option value="en">English</option></select></Field>
        <Field label="Zona waktu" hint="Jadwal dan pengingat memakai zona waktu ini."><select className="px-in" value={tz} onChange={(e) => set({ timezone: e.target.value })}>{(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => <option key={z}>{z}</option>)}</select></Field>
      </Panel>
    </div>
  );
}

function NotifTab() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  if (!settings) return <Loading />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Notifikasi" icon="bell">
        <label className="mb-4 flex cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={settings.notifications_enabled} onChange={(e) => update({ notifications_enabled: e.target.checked }).then(() => toast(e.target.checked ? 'Notifikasi diaktifkan' : 'Notifikasi dimatikan; pengingat terjadwal dibatalkan')).catch((x) => toast(x.message, 'error'))} />Aktifkan notifikasi dan pengingat</label>
        <Button variant="alt" icon="bell" onClick={async () => toast(await enablePush().catch((e) => e.message))}>Aktifkan push di perangkat ini</Button>
      </Panel>
      <Panel title="Preferensi pengingat" icon="clock">
        <ul className="space-y-1 text-sm"><li>Kelas: 15 menit sebelum mulai</li><li>Belajar mandiri: 30 menit sebelum mulai</li><li>Persiapan ujian: 1 hari sebelumnya</li><li>Deadline tugas: 1 hari sebelumnya</li><li>Tugas prioritas tinggi: 3 hari dan 1 hari sebelumnya</li></ul>
        <p className="mt-3 text-sm text-muted">Waktu tiap pengingat bisa diubah atau dimatikan satu per satu di menu Notifikasi.</p>
      </Panel>
    </div>
  );
}

function AccountTab() {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false); const [typed, setTyped] = useState('');
  const logout = async () => { await supabase.auth.signOut(); nav('/'); };
  const del = useMut(() => api('/profile', { method: 'DELETE' }), undefined, async () => { await supabase.auth.signOut(); nav('/'); });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Sesi" icon="logout"><p className="mb-3">Keluar dari perangkat ini.</p><Button variant="alt" icon="logout" onClick={logout}>Keluar</Button></Panel>
      <Panel title="Hapus akun" icon="trash">
        <p className="mb-3">Seluruh data kamu — jadwal, tugas, catatan, dan file — dihapus permanen dan tidak bisa dikembalikan.</p>
        <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Hapus akun saya</Button>
      </Panel>
      {confirm && (
        <Modal title="Hapus akun?" onClose={() => setConfirm(false)}>
          <Field label="Ketik HAPUS untuk melanjutkan"><input className="px-in" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end"><Button variant="alt" onClick={() => setConfirm(false)}>Batal</Button><Button variant="danger" disabled={typed !== 'HAPUS' || del.isPending} onClick={() => del.mutate(undefined)}>Hapus permanen</Button></div>
        </Modal>
      )}
    </div>
  );
}
