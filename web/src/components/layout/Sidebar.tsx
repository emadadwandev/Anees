'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Bell,
  BarChart2,
  FileText,
  Cpu,
  Settings,
} from 'lucide-react';
import { useAlertStore } from '@/lib/store';

const navItems = [
  { href: '/roster',    label: 'Roster',    icon: Users },
  { href: '/alerts',   label: 'Alerts',    icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/reports',  label: 'Reports',   icon: FileText },
  { href: '/devices',  label: 'Devices',   icon: Cpu },
  { href: '/settings', label: 'Settings',  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const unreadCount = useAlertStore((s) => s.unreadCount);

  return (
    <aside
      className="hidden md:flex flex-col w-16 lg:w-56 shrink-0"
      style={{ background: 'var(--adm-sidebar)', borderRight: '1px solid var(--adm-border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-4"
        style={{ borderBottom: '1px solid var(--adm-border)' }}
      >
        <span className="text-xl font-bold hidden lg:block" style={{ color: 'var(--adm-t1)' }}>
          Anees
        </span>
        <span className="text-xl font-bold lg:hidden" style={{ color: 'var(--adm-blue)' }}>
          A
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const isAlerts = href === '/alerts';
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={
                active
                  ? {
                      background: 'var(--adm-blue-dim)',
                      color: 'var(--adm-blue)',
                    }
                  : {
                      color: 'var(--adm-t2)',
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--adm-card-hover)';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--adm-t1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = '';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--adm-t2)';
                }
              }}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
              {isAlerts && unreadCount > 0 && (
                <span
                  className="ml-auto text-white text-xs rounded-full px-1.5 py-0.5 hidden lg:block"
                  style={{ background: 'var(--adm-red)' }}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
