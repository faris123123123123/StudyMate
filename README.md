# StudyMate

Personal learning companion dengan UI pixel art. React + Vite + TypeScript + Tailwind, Node/Express, Supabase (Postgres, Auth, Storage), PWA, Tauri (desktop), Capacitor (mobile). Tanpa AI (sesuai PRD v2.0).

> **Status:** jalankan `npm install && npm run typecheck && npm run build` untuk validasi lokal. Deployment serverless tidak menjalankan `node-cron`; gunakan scheduler eksternal untuk memanggil pemrosesan reminder secara berkala.

## Mulai cepat

1. Buat project di [Supabase](https://supabase.com). Di *Authentication → Providers → Email* aktifkan **Confirm email**; di *URL Configuration* tambahkan redirect `http://localhost:5173/login` dan `http://localhost:5173/reset`.
2. Jalankan isi `supabase/migrations/0001_init.sql` di SQL Editor (tabel, RLS, trigger, bucket privat).
3. Salin `server/.env.example` → `server/.env` dan `web/.env.example` → `web/.env`, isi URL + key Supabase. Service-role key **hanya** di server.
4. (Opsional, untuk push) `npx web-push generate-vapid-keys`, isi `VAPID_*` di `server/.env`.
5. ```bash
   npm install
   npm run typecheck
   npm run dev:server   # http://localhost:4000
   npm run dev:web      # http://localhost:5173 (proxy /api → :4000)
   ```

## Arsitektur singkat

* Frontend memanggil **Express** untuk semua data. Express memverifikasi JWT Supabase lalu memakai client atas nama pengguna, sehingga **RLS tetap berlaku**. Service-role hanya dipakai worker pengingat, hapus akun, dan pembersihan storage.
* Worker (`node-cron`) tiap menit memproses `reminders` jatuh tempo: klaim atomik → buat `notifications` → kirim Web Push. Pengingat kelas berulang diperpanjang tiap hari 00:05.
* Upload file lewat Express (validasi ekstensi + MIME, batas ukuran, kuota), progress via XHR.
* Konflik edit: klien mengirim `expected_updated_at`; server membalas 409 bila data sudah berubah.

## Desktop dan mobile

```bash
# Desktop (butuh Rust). Buat ikon: cd web && npx tauri icon app-icon.png
VITE_API_URL=https://api.contoh.com npm run tauri -w web -- build

# Mobile
cd web && npx cap add android && npx cap add ios
VITE_API_URL=https://api.contoh.com npm run cap:sync
```
`VITE_API_URL` **wajib URL penuh** untuk build Tauri/Capacitor (tidak ada proxy Vite). Origin Tauri dan Capacitor sudah masuk `CORS_ORIGINS`.

## Dokumen

`docs/TRACEABILITY.md` memetakan PRD → SRS → ERD → kode, dan memuat **celah antar-dokumen** yang perlu Anda putuskan.
# StudyMate
