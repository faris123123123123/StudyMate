import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { labelOfDay } from '../lib/dates';
import { useSettings } from '../lib/settings';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { Mate } from './mate';
import { Button, PixelIcon, cx, type IconName } from './px';

const NAV: [string, string, IconName][] = [
  ['dashboard', '/app', 'home'], ['planner', '/app/planner', 'calendar'], ['classes', '/app/classes', 'class'],
  ['assignments', '/app/assignments', 'tasks'], ['library', '/app/library', 'folder'], ['notes', '/app/notes', 'note'],
  ['focus', '/app/focus', 'timer'], ['analytics', '/app/analytics', 'chart'], ['notifications', '/app/notifications', 'bell'], ['settings', '/app/settings', 'gear'],
];

export function AppShell() {
  const { t, tz, lang } = useSettings();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const { data: me } = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const { data: unread } = useQuery({ queryKey: ['unread'], queryFn: () => api<{ count: number }>('/notifications/unread-count'), refetchInterval: 30_000 });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const logout = async () => { await supabase.auth.signOut(); nav('/'); };

  const link = (to: string, key: string, icon: IconName, compact = false) => (
    <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => cx(isActive && 'active', compact && 'flex-col !gap-1 !px-3 !py-2 text-xs')} aria-label={t(key)}>
      <span className="relative"><PixelIcon name={icon} size={compact ? 22 : 20} />
        {key === 'notifications' && !!unread?.count && <b className="absolute -right-2 -top-2 min-w-[16px] bg-danger px-1 text-center text-[10px] text-white">{unread.count > 9 ? '9+' : unread.count}</b>}
      </span>
      {t(key)}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="px px-flat sticky top-0 hidden h-screen w-60 flex-none flex-col overflow-y-auto !m-0 !shadow-none border-r-4 border-line bg-surface md:flex">
        <div className="flex items-center gap-2 p-4"><Mate size={44} bob={false} /><span className="font-pixel text-[11px] text-primary">STUDY<br />MATE</span></div>
        <nav className="px-nav flex-1 pb-4" aria-label="Navigasi utama">{NAV.map(([k, to, i]) => link(to, k, i))}</nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="safe-t sticky top-0 z-20 flex items-center justify-between gap-3 border-b-4 border-line bg-surface px-4 py-3">
          <p className="text-sm text-muted">{labelOfDay(today, 'EEEE, d MMMM yyyy', lang)}</p>
          <div className="relative flex items-center">
            <Button sm variant="alt" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
              {me?.avatar_signed_url ? <img src={me.avatar_signed_url} alt="" className="h-5 w-5 object-cover" style={{ imageRendering: 'pixelated' }} /> : <PixelIcon name="user" size={16} />}
              <span className="max-w-[120px] truncate">{me?.full_name ?? '...'}</span>
            </Button>
            {menu && (
              <div role="menu" className="px absolute right-0 top-full z-30 mt-3 w-48 p-2" onClick={() => setMenu(false)}>
                <NavLink role="menuitem" to="/app/settings" className="flex items-center gap-2 p-2 hover:bg-soft"><PixelIcon name="gear" size={16} />{t('settings')}</NavLink>
                <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 p-2 text-left text-danger hover:bg-soft"><PixelIcon name="logout" size={16} />{t('logout')}</button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-10"><Outlet /></main>
      </div>

      <nav className="px-nav safe-b fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t-4 border-line bg-surface md:hidden" aria-label="Navigasi seluler">
        {NAV.map(([k, to, i]) => link(to, k, i, true))}
      </nav>
    </div>
  );
}
