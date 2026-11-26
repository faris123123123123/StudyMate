import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL ?? '';
const OFFLINE = 'Koneksi gagal. Periksa internet kamu — perubahan belum tersimpan.';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString() ? `?${params}` : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}${qs}`, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'Terjadi kesalahan.');
  return json as T;
}

/** Upload multipart dengan progress (XHR, karena fetch belum punya upload progress). */
export async function upload<T = any>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  const t = await token();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(0, OFFLINE));
    xhr.onload = () => {
      let json: any = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* kosong */ }
      xhr.status >= 200 && xhr.status < 300 ? resolve(json) : reject(new ApiError(xhr.status, json.error ?? 'Upload gagal.'));
    };
    xhr.send(form);
  });
}
