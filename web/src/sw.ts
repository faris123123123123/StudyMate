/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (e) => {
  const d = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? 'StudyMate', {
      body: d.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: d.url ?? '/app/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url ?? '/app/notifications'));
});
