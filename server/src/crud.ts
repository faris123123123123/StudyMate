import { Router, type Request } from 'express';
import type { ZodObject } from 'zod';
import { HttpError, check, mapErr, wrap } from './http.js';

type Op = 'create' | 'update' | 'delete';
type Method = 'list' | 'get' | 'create' | 'update' | 'delete';

interface Opts {
  table: string;
  create: ZodObject<any>;
  methods?: Method[];
  order?: { col: string; asc?: boolean };
  sortable?: string[];
  filters?: string[]; // ?kolom=nilai, ?kolom=null, ?kolom_not=nilai
  search?: string[];
  range?: string; // ?from=&to= pada kolom ini
  validate?: (merged: any, id?: string) => string | null;
  before?: (req: Request, body: any, op: 'create' | 'update', prev?: any) => any | Promise<any>;
  after?: (req: Request, row: any, op: Op, prev?: any) => unknown | Promise<unknown>;
}

const q1 = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);

/** Router CRUD generik: semua query lewat client pengguna sehingga RLS berlaku. Paginasi wajib (SRS 5.1). */
export function crud(o: Opts) {
  const r = Router();
  const on = (m: Method) => !o.methods || o.methods.includes(m);
  const updateSchema = o.create.partial();

  if (on('list'))
    r.get('/', wrap(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const size = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      let q = req.db.from(o.table).select('*', { count: 'exact' });
      for (const f of o.filters ?? []) {
        const v = q1(req.query[f]);
        if (v !== undefined) q = v === 'null' ? q.is(f, null) : q.eq(f, v);
        const n = q1(req.query[`${f}_not`]);
        if (n !== undefined) q = n === 'null' ? q.not(f, 'is', null) : q.neq(f, n);
      }
      if (o.range) {
        const from = q1(req.query.from), to = q1(req.query.to);
        if (from) q = q.gte(o.range, from);
        if (to) q = q.lt(o.range, to);
      }
      const s = (q1(req.query.q) ?? '').trim().replace(/[%,()*]/g, ' ');
      if (s && o.search?.length) q = q.or(o.search.map((c) => `${c}.ilike.%${s}%`).join(','));
      const sort = q1(req.query.sort);
      if (sort && o.sortable?.includes(sort)) q = q.order(sort, { ascending: req.query.dir !== 'desc' });
      else if (o.order) q = q.order(o.order.col, { ascending: o.order.asc ?? false });
      const { data, error, count } = await q.range((page - 1) * size, page * size - 1);
      if (error) throw mapErr(error);
      res.json({ data, total: count ?? 0, page, pageSize: size });
    }));

  if (on('get'))
    r.get('/:id', wrap(async (req, res) => {
      const row = check(await req.db.from(o.table).select('*').eq('id', req.params.id).maybeSingle());
      if (!row) throw new HttpError(404, 'Data tidak ditemukan.');
      res.json(row);
    }));

  if (on('create'))
    r.post('/', wrap(async (req, res) => {
      let body = o.create.parse(req.body);
      const msg = o.validate?.(body);
      if (msg) throw new HttpError(400, msg);
      if (o.before) body = (await o.before(req, body, 'create')) ?? body;
      const row = check(await req.db.from(o.table).insert({ ...body, user_id: req.user.id }).select().single());
      await o.after?.(req, row, 'create');
      res.status(201).json(row);
    }));

  if (on('update'))
    r.put('/:id', wrap(async (req, res) => {
      const id = req.params.id;
      const prev = check(await req.db.from(o.table).select('*').eq('id', id).maybeSingle());
      if (!prev) throw new HttpError(404, 'Data tidak ditemukan.');
      let body = updateSchema.parse(req.body);
      const prevObj = typeof prev === 'object' && prev !== null ? prev as Record<string, unknown> : {};
      const bodyObj = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
      const msg = o.validate?.({ ...prevObj, ...bodyObj }, id);
      if (msg) throw new HttpError(400, msg);
      if (o.before) body = (await o.before(req, body, 'update', prev)) ?? body;
      // Deteksi konflik (SRS 12.2): jika klien mengirim updated_at yang dilihatnya, tolak bila sudah berubah.
      const expected = typeof req.body?.expected_updated_at === 'string' ? req.body.expected_updated_at : undefined;
      let q = req.db.from(o.table).update(body).eq('id', id);
      if (expected) q = q.eq('updated_at', expected);
      const row = check(await q.select().maybeSingle());
      if (!row) throw new HttpError(409, 'Data ini sudah diubah dari perangkat lain. Muat ulang dulu agar tidak menimpa perubahan tersebut.');
      await o.after?.(req, row, 'update', prev);
      res.json(row);
    }));

  if (on('delete'))
    r.delete('/:id', wrap(async (req, res) => {
      const prev = check(await req.db.from(o.table).select('*').eq('id', req.params.id).maybeSingle());
      if (!prev) throw new HttpError(404, 'Data tidak ditemukan.');
      check(await req.db.from(o.table).delete().eq('id', req.params.id).select().maybeSingle());
      await o.after?.(req, prev, 'delete', prev);
      res.status(204).end();
    }));

  return r;
}
