import webpush from 'web-push';
import { env } from '../config.js';
import { admin } from '../supabase.js';

const enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

export const vapidPublicKey = () => env.VAPID_PUBLIC_KEY ?? null;

/** Web Push untuk platform web & desktop. Token native (FCM/APNs) belum termasuk MVP. */
export async function pushTo(userId: string, payload: { title: string; message: string; url?: string }) {
  if (!enabled) return;
  const { data } = await admin.from('push_subscriptions').select('*').eq('user_id', userId).in('platform', ['web', 'desktop']);
  for (const sub of data ?? []) {
    try {
      await webpush.sendNotification(sub.subscription_data as webpush.PushSubscription, JSON.stringify(payload));
      await admin.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).eq('id', sub.id);
    } catch (e: any) {
      // Langganan kedaluwarsa harus dihapus (ERD 8.13)
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id);
      else console.error('push gagal', e?.statusCode ?? e?.message);
    }
  }
}
