import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategy: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'StudyMate',
        short_name: 'StudyMate',
        description: 'Personal learning companion: jadwal, tugas, materi, catatan, dan fokus.',
        theme_color: '#174A82',
        background_color: '#F4F7FB',
        display: 'standalone',
        start_url: '/app',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
