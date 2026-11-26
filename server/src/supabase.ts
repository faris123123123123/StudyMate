import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';

/** Service-role: HANYA untuk worker, hapus akun, dan pembersihan storage. Melewati RLS. */
export const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Client atas nama pengguna: JWT pengguna diteruskan sehingga RLS tetap berlaku. */
export const userClient = (token: string) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
