import { useState } from 'react';
import { Button, Empty, ErrorBox, Field, Loading, Modal, PageHead, Panel, PixelIcon, Tabs, Tag, useToast, type IconName } from '../components/px';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fromInput, toInput } from '../lib/dates';
import { useInfinite, useMut } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import type { AppNotification, Reminder } from '../lib/types';

const ICON: Record<string, IconName> = { schedule_start: 'calendar', deadline_near: 'clock', study_reminder: 'class', status_change: 'tasks' };
export const platformOf = () => {
  const native = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.();
  return native ?? ('__TAURI_INTERNALS__' in window ? 'desktop' : 'web');
};

export async function enablePush(): Promise<string> {
  const p = platformOf();
  if (p === 'android' || p === 'ios') return 'Push di aplikasi seluler memerlukan konfigurasi FCM/APNs (lihat README). Notifikasi dalam aplikasi tetap aktif.';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'Browser ini tidak mendukung push notification.';
  const { key } = await api<{ key: string | null }>('/push-subscriptions/vapid-public-key');
  if (!key) return 'Server belum dikonfigurasi untuk push (VAPID key kosong).';
  if ((await Notification.requestPermission()) !== 'granted') return 'Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.';
  const reg = await navigator.serviceWorker.ready;
  const pad = '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
  await api('/push-subscriptions', { method: 'POST', body: { platform: p, endpoint: sub.endpoint, subscription_data: sub.toJSON(), device_name: navigator.userAgent.slice(0, 120) } });
  return 'Push notification aktif di perangkat ini.';
}

export default function Notifications() {
  const { fmt, tz } = useSettings();
  const { toast } = useToast();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [rem, setRem] = useState<Reminder | null>(null);
  const list = useInfinite<AppNotification>('notifications', '/notifications', { is_read: tab === 'unread' ? 'false' : '' });
  const reminders = useQuery({ queryKey: ['reminders'], queryFn: () => api<{ data: Reminder[] }>('/reminders').then((r) => r.data) });
  const read = useMut((id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }));
  const readAll = useMut(() => api('/notifications/read-all', { method: 'POST' }), 'Semua ditandai dibaca');
  const remove = useMut((id: string) => api(`/notifications/${id}`, { method: 'DELETE' }));
  const toggle = useMut((r: Reminder) => api(`/reminders/${r.id}`, { method: 'PATCH', body: { status: r.status === 'pending' ? 'cancelled' : 'pending' } }));

  return (
    <>
      <PageHead title="Notifikasi" icon="bell">
        <Button variant="alt" icon="bell" onClick={async () => toast(await enablePush().catch((e) => e.message))}>Aktifkan push</Button>
        <Button icon="check" onClick={() => readAll.mutate(undefined)}>Tandai semua dibaca</Button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'Semua' }, { id: 'unread', label: 'Belum dibaca' }]} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div>
          {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : list.items.length === 0 ? <Empty icon="bell" title="Belum ada notifikasi" hint="Pengingat jadwal dan deadline akan muncul di sini." /> : (
            <div className="space-y-3">{list.items.map((n) => (
              <Panel key={n.id} className={n.is_read ? 'opacity-70' : ''}><div className="flex items-start gap-3">
                <PixelIcon name={ICON[n.type]} size={24} className={n.is_read ? 'text-muted' : 'text-secondary'} />
                <div className="min-w-0 flex-1"><p className="break-words">{n.title} {!n.is_read && <Tag color="#F2B63D">Baru</Tag>}</p><p className="text-sm">{n.message}</p><p className="text-xs text-muted">{fmt(n.created_at, 'd MMM yyyy, HH:mm')}</p></div>
                <div className="flex">{!n.is_read && <Button sm variant="alt" icon="check" aria-label="Tandai dibaca" onClick={() => read.mutate(n.id)} />}<Button sm variant="danger" icon="trash" aria-label="Hapus" onClick={() => remove.mutate(n.id)} /></div>
              </div></Panel>))}
              {list.hasNextPage && <div className="text-center"><Button variant="alt" onClick={() => list.fetchNextPage()}>Muat lagi</Button></div>}</div>)}
        </div>
        <Panel title="Pengingat mendatang" icon="clock">
          <p className="mb-3 text-sm text-muted">Default: kelas 15 menit, belajar 30 menit, deadline 1 hari (tugas prioritas tinggi: 3 hari dan 1 hari) sebelumnya. Ubah waktunya atau nonaktifkan di sini.</p>
          {reminders.isLoading ? <Loading /> : !reminders.data?.length ? <p className="text-muted">Belum ada pengingat terjadwal.</p> : (
            <ul className="space-y-2">{reminders.data.map((r) => (
              <li key={r.id} className={`flex items-center gap-2 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1"><p className="truncate">{r.source_title}</p><p className="text-sm text-muted">{fmt(r.remind_at, 'EEE d MMM, HH:mm')} {r.status === 'cancelled' && <Tag>Nonaktif</Tag>}</p></div>
                <Button sm variant="alt" icon="edit" aria-label="Ubah waktu" disabled={r.status === 'cancelled'} onClick={() => setRem(r)} />
                <Button sm variant={r.status === 'pending' ? 'alt' : 'grass'} onClick={() => toggle.mutate(r)}>{r.status === 'pending' ? 'Matikan' : 'Aktifkan'}</Button>
              </li>))}</ul>)}
        </Panel>
      </div>
      {rem && <RemForm r={rem} tz={tz} onClose={() => setRem(null)} />}
    </>
  );
}

function RemForm({ r, tz, onClose }: { r: Reminder; tz: string; onClose: () => void }) {
  const [v, setV] = useState(toInput(r.remind_at, tz));
  const save = useMut(() => api(`/reminders/${r.id}`, { method: 'PATCH', body: { remind_at: fromInput(v, tz) } }), 'Waktu pengingat diubah', onClose);
  return (
    <Modal title={`Pengingat: ${r.source_title}`} onClose={onClose}>
      <Field label="Ingatkan pada"><input className="px-in" type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} /></Field>
      <div className="flex justify-end"><Button variant="alt" onClick={onClose}>Batal</Button><Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>Simpan</Button></div>
    </Modal>
  );
}
