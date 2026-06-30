'use client';

import { useState } from 'react';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useAlertStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export function TopBar() {
  const { data: session } = useSession();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const clearUnread = useAlertStore((s) => s.clearUnread);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/roster?search=${encodeURIComponent(search)}`);
    }
  }

  return (
    <header
      className="h-16 flex items-center px-4 gap-4 shrink-0"
      style={{ background: 'var(--adm-sidebar)', borderBottom: '1px solid var(--adm-border)' }}
    >
      {/* Live indicator */}
      <span className="adm-live-dot hidden lg:inline-block" />

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--adm-t3)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--adm-border)',
              color: 'var(--adm-t1)',
            }}
          />
        </div>
      </form>

      <div className="flex items-center gap-3 ml-auto">
        {/* Alert bell */}
        <button
          onClick={() => { clearUnread(); router.push('/alerts'); }}
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--adm-t2)' }}
          aria-label="Alerts"
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold"
              style={{ background: 'var(--adm-red)' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{ background: 'var(--adm-blue)' }}
            >
              {session?.user?.name?.[0] ?? 'C'}
            </div>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-44 rounded-xl shadow-lg py-1 z-50"
              style={{
                background: '#0d1529',
                border: '1px solid var(--adm-border-hi)',
              }}
            >
              <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--adm-border)' }}>
                <p className="text-xs font-medium truncate" style={{ color: 'var(--adm-t1)' }}>
                  {session?.user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--adm-t3)' }}>
                  {session?.user?.email}
                </p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--adm-t2)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-card-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
              >
                <User size={14} /> Profile
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--adm-red)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-red-dim)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
