import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Paged } from './types';
import { useToast } from '../components/px';

/** Daftar kecil (mata kuliah, folder, jadwal kelas) — satu halaman 100 data. */
export function useList<T>(key: string, path: string, query: Record<string, unknown> = {}, enabled = true) {
  return useQuery({ queryKey: [key, query], enabled, queryFn: () => api<Paged<T>>(path, { query: { pageSize: 100, ...query } }).then((r) => r.data) });
}

/** Daftar panjang dengan paginasi "muat lagi" (SRS 5.1). */
export function useInfinite<T>(key: string, path: string, query: Record<string, unknown> = {}, pageSize = 30) {
  const q = useInfiniteQuery({
    queryKey: [key, 'inf', query],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<T>>(path, { query: { ...query, page: pageParam, pageSize } }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  return { ...q, items: q.data?.pages.flatMap((p) => p.data) ?? [], total: q.data?.pages[0]?.total ?? 0 };
}

/** Mutasi + invalidasi semua query aktif + toast. Data dianggap tersimpan hanya bila server berhasil (SRS 5.4). */
export function useMut<V = any, R = any>(fn: (v: V) => Promise<R>, okMsg?: string, onOk?: (r: R) => void) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => { qc.invalidateQueries(); if (okMsg) toast(okMsg); onOk?.(r); },
    onError: (e: Error) => toast(e.message, 'error'),
  });
}
