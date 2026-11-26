import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { env } from './config.js';
import { admin, userClient } from './supabase.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User;
      db: SupabaseClient;
      token: string;
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function mapErr(e: any): HttpError {
  const code = e?.code;
  if (code === '23514') return new HttpError(400, 'Data tidak memenuhi aturan validasi.');
  if (code === '23503') return new HttpError(400, 'Data terkait tidak ditemukan.');
  if (code === '23505') return new HttpError(409, 'Data tersebut sudah ada.');
  if (code === '22P02') return new HttpError(400, 'Format data tidak valid.');
  if (code === '42501' || code === 'PGRST301') return new HttpError(403, 'Kamu tidak punya akses ke data ini.');
  return new HttpError(500, e?.message ?? 'Terjadi kesalahan.');
}

/** Lempar error terpetakan jika query Supabase gagal; kembalikan data bila sukses. */
export function check<T>(r: { data: T | null; error: any }): T {
  if (r.error) throw mapErr(r.error);
  return r.data as T;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new HttpError(401, 'Silakan masuk terlebih dahulu.'));
  admin.auth
    .getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) return next(new HttpError(401, 'Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.'));
      req.user = data.user;
      req.token = token;
      req.db = userClient(token);
      next();
    })
    .catch(next);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
    return res.status(400).json({ error: msg });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Ukuran file melebihi batas ${env.MAX_UPLOAD_MB} MB.` });
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Terjadi kesalahan pada server.' : err.message });
};
