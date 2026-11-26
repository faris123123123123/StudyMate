import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { api } from './api';
import { fmt as fmtDate } from './dates';
import { makeT } from './i18n';
import type { UserSettings } from './types';

interface Ctx { settings?: UserSettings; tz: string; lang: string; theme: string; t: (k: string) => string; fmt: (iso: string | Date, p: string) => string; update: (patch: Partial<UserSettings>) => Promise<void> }
const SettingsCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSettings = () => useContext(SettingsCtx);

export const applyTheme = (theme: string) => { document.documentElement.dataset.theme = theme; localStorage.setItem('sm-theme', theme); };

export function SettingsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api<UserSettings>('/settings') });
  const tz = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta';
  const lang = data?.language ?? 'id';
  const theme = data?.theme ?? localStorage.getItem('sm-theme') ?? 'light';
  useEffect(() => { applyTheme(theme); document.documentElement.lang = lang; }, [theme, lang]);
  const update = async (patch: Partial<UserSettings>) => {
    if (patch.theme) applyTheme(patch.theme); // terapkan langsung, server menyusul
    const row = await api<UserSettings>('/settings', { method: 'PUT', body: patch });
    qc.setQueryData(['settings'], row);
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'settings' });
  };
  return <SettingsCtx.Provider value={{ settings: data, tz, lang, theme, t: makeT(lang), fmt: (i, p) => fmtDate(i, p, tz, lang), update }}>{children}</SettingsCtx.Provider>;
}
