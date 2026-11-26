import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '../components/px';
import { supabase } from './supabase';

const Ctx = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>;
}

/** BR-003: halaman pribadi hanya untuk pengguna yang sudah masuk. */
export function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading full />;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

/** Kebijakan password: min. 8 karakter, huruf besar, huruf kecil, angka. */
export function passwordError(p: string): string | null {
  if (p.length < 8) return 'Password minimal 8 karakter.';
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) return 'Password harus mengandung huruf besar, huruf kecil, dan angka.';
  return null;
}
