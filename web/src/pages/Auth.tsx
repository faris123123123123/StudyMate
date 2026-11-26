import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mate } from '../components/mate';
import { Button, Field, Loading, Panel } from '../components/px';
import { passwordError, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

function Layout({ title, children, mood = 'idle' }: { title: string; children: ReactNode; mood?: 'idle' | 'happy' }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 flex items-center justify-center gap-3"><Mate size={64} mood={mood} /><span className="font-pixel text-xs text-primary">STUDYMATE</span></Link>
        <Panel title={title}>{children}</Panel>
      </div>
    </div>
  );
}

const authMsg = (m: string) =>
  /not confirmed/i.test(m) ? 'Email belum diverifikasi. Cek kotak masuk kamu.' :
  /invalid login/i.test(m) ? 'Email atau password salah.' :
  /already registered/i.test(m) ? 'Email ini sudah terdaftar.' :
  /rate limit/i.test(m) ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' : m;

export function Login() {
  const { session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/app" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(authMsg(error.message)); else nav(loc.state?.from ?? '/app', { replace: true });
  };
  return (
    <Layout title="Masuk">
      <form onSubmit={submit}>
        <Field label="Email"><input className="px-in" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" error={err}><input className="px-in" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Masuk...' : 'Masuk'}</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-secondary underline" to="/forgot">Lupa password?</Link> · <Link className="text-secondary underline" to="/register">Buat akun</Link></p>
    </Layout>
  );
}

export function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    const pe = passwordError(f.pw);
    if (pe) return setErr(pe);
    if (f.pw !== f.pw2) return setErr('Konfirmasi password tidak sama.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.pw, options: { data: { full_name: f.name.trim() }, emailRedirectTo: `${location.origin}/login` } });
    setBusy(false);
    if (error) return setErr(authMsg(error.message));
    if (data.session) nav('/app'); else setSent(true);
  };
  if (sent) return <Layout title="Cek email kamu" mood="happy"><p>Kami mengirim tautan verifikasi ke <b>{f.email}</b>. Buka tautan itu, lalu masuk.</p><Link to="/login"><Button className="mt-4">Ke halaman masuk</Button></Link></Layout>;
  return (
    <Layout title="Buat akun">
      <form onSubmit={submit}>
        <Field label="Nama lengkap"><input className="px-in" required maxLength={100} value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="px-in" type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="Minimal 8 karakter, huruf besar, huruf kecil, dan angka."><input className="px-in" type="password" required autoComplete="new-password" value={f.pw} onChange={set('pw')} /></Field>
        <Field label="Ulangi password" error={err}><input className="px-in" type="password" required autoComplete="new-password" value={f.pw2} onChange={set('pw2')} /></Field>
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Mendaftar...' : 'Daftar'}</Button>
      </form>
      <p className="mt-4 text-sm">Sudah punya akun? <Link className="text-secondary underline" to="/login">Masuk</Link></p>
    </Layout>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset` });
    if (error) setErr(authMsg(error.message)); else setDone(true);
  };
  return (
    <Layout title="Lupa password">
      {done ? <p>Jika email terdaftar, tautan reset sudah dikirim. Cek kotak masuk kamu.</p> : (
        <form onSubmit={submit}>
          <Field label="Email akun" error={err}><input className="px-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" className="w-full">Kirim tautan reset</Button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link className="text-secondary underline" to="/login">Kembali masuk</Link></p>
    </Layout>
  );
}

export function Reset() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState(''); const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 1500); return () => clearTimeout(t); }, []);
  if (loading || (!session && !ready)) return <Loading full />;
  if (!session) return <Layout title="Tautan tidak valid"><p>Tautan reset sudah kedaluwarsa. Minta tautan baru.</p><Link to="/forgot"><Button className="mt-4">Minta tautan baru</Button></Link></Layout>;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pe = passwordError(pw);
    if (pe) return setErr(pe);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setErr(authMsg(error.message)); else nav('/app');
  };
  return (
    <Layout title="Password baru">
      <form onSubmit={submit}>
        <Field label="Password baru" error={err}><input className="px-in" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button type="submit" className="w-full">Simpan password</Button>
      </form>
    </Layout>
  );
}
