'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { io } from 'socket.io-client';
import { clsx } from 'clsx';
import {
  Users,
  Bell,
  BarChart2,
  Cpu,
  Settings,
  LogOut,
  Radio,
  PhoneOff,
  UserCircle2,
} from 'lucide-react';
import { useAdminStore } from '@/lib/admin-store';
import type { AdminAlertEvent, VitalsUpdate, DeviceOffline, AlertStateChange } from '@/lib/types';

const NAV = [
  { href: '/admin/roster',    label: 'Patients',       icon: Users },
  { href: '/admin/alerts',    label: 'Alerts Center',  icon: Bell },
  { href: '/admin/analytics', label: 'Analytics',      icon: BarChart2 },
  { href: '/admin/devices',   label: 'Devices',        icon: Cpu },
  { href: '/admin/settings',  label: 'Settings',       icon: Settings },
];

interface Props {
  children: React.ReactNode;
}

export function AdminShell({ children }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();

  const {
    stats,
    unreadAlerts,
    caregiverSocket,
    setCaregiverSocket,
    setVitalsSocket,
    upsertVital,
    addAlert,
    updateAlertStatus,
    removeAlert,
    setDeviceOffline,
    clearUnread,
  } = useAdminStore();

  // Live call state
  const [callActive, setCallActive] = useState(false);
  const [callRoom, setCallRoom] = useState('');
  const [callSecs, setCallSecs] = useState(0);
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Socket setup
  useEffect(() => {
    if (!session?.accessToken) return;

    const apiBase = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';

    const cgSocket = io(`${apiBase}/caregiver`, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 30_000,
    });

    const vtSocket = io(`${apiBase}/vitals`, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelayMax: 30_000,
    });

    cgSocket.on('fall.detected', (event: AdminAlertEvent, ack?: () => void) => {
      addAlert({
        id: event.id ?? (event as any).alertId,
        patientId: event.patientId,
        patientName: event.patientName ?? '',
        patientRoom: event.patientRoom ?? (event as any).room ?? '',
        type: 'fall',
        status: 'dispatched',
        triggeredAt: event.triggeredAt ?? (event as any).detectedAt,
      });
      if (typeof ack === 'function') ack();
    });

    cgSocket.on('alert.state_changed', (event: AlertStateChange) => {
      updateAlertStatus(event.alertId, event.state);
      if (['resolved', 'cancelled_by_user', 'false_alarm'].includes(event.state)) {
        setTimeout(() => removeAlert(event.alertId), 2000);
      }
    });

    cgSocket.on('alert.vital', (event: AdminAlertEvent) => {
      addAlert({ ...event, type: 'vital_anomaly', status: 'dispatched' });
    });

    cgSocket.on('system.device_offline', (event: DeviceOffline) => {
      setDeviceOffline(event.patientId);
    });

    vtSocket.on('vitals.update', (event: VitalsUpdate) => {
      upsertVital(event.patientId, {
        hr: event.hr,
        rr: event.rr,
        quality: event.quality,
        ts: event.timestamp,
      });
    });

    setCaregiverSocket(cgSocket);
    setVitalsSocket(vtSocket);

    return () => {
      cgSocket.disconnect();
      vtSocket.disconnect();
      setCaregiverSocket(null);
      setVitalsSocket(null);
    };
  }, [session?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAlertsPage = pathname === '/admin/alerts';

  function startCall(room: string) {
    setCallActive(true);
    setCallRoom(room);
    setCallSecs(0);
    if (callTimer.current) clearInterval(callTimer.current);
    callTimer.current = setInterval(() => setCallSecs((s) => s + 1), 1000);
  }

  function endCall() {
    setCallActive(false);
    if (callTimer.current) clearInterval(callTimer.current);
  }

  const fmtSecs = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="adm-shell flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 w-14 lg:w-[216px] border-r"
        style={{ background: 'var(--adm-sidebar)', borderColor: 'var(--adm-border)', position: 'relative' }}
      >
        {/* Sidebar accent line */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(26,115,232,0.3) 40%, rgba(26,115,232,0.12) 70%, transparent)' }}
        />

        {/* Logo */}
        <div
          className="flex items-center gap-3 h-[60px] px-4 shrink-0"
          style={{ borderBottom: '1px solid var(--adm-border)' }}
        >
          <div
            className="flex items-center justify-center w-[30px] h-[30px] rounded-lg shrink-0 text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #1a73e8, #0d4fa3)' }}
          >
            AN
          </div>
          <div className="hidden lg:block">
            <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--adm-t1)' }}>
              Anees
            </div>
            <div
              className="text-[9px] font-semibold tracking-[1.5px] uppercase"
              style={{ color: 'var(--adm-t3)' }}
            >
              Clinical OS
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          <p
            className="hidden lg:block text-[9px] font-semibold tracking-[1.8px] uppercase px-2 mb-1.5 mt-0"
            style={{ color: 'var(--adm-t3)' }}
          >
            Overview
          </p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const isAlerts = href === '/admin/alerts';
            return (
              <Link
                key={href}
                href={href}
                onClick={isAlerts ? clearUnread : undefined}
                className={clsx(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all',
                  active
                    ? 'bg-[var(--adm-blue-dim)] text-[#60a5fa] border border-[rgba(96,165,250,0.18)]'
                    : 'border border-transparent hover:bg-[rgba(255,255,255,0.04)]',
                )}
                style={{ color: active ? '#60a5fa' : 'var(--adm-t2)' }}
              >
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:block">{label}</span>
                {isAlerts && unreadAlerts > 0 && (
                  <span
                    className="ml-auto hidden lg:flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold text-white adm-badge-red"
                    style={{ background: 'var(--adm-red)' }}
                  >
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div
          className="px-2 py-3 shrink-0 space-y-1"
          style={{ borderTop: '1px solid var(--adm-border)' }}
        >
          {/* Profile link */}
          <Link
            href="/admin/profile"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all hover:bg-[rgba(255,255,255,0.04)]"
          >
            <div
              className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #1a73e8, #0d4fa3)' }}
            >
              {(session?.user?.name ?? 'A').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--adm-t1)' }}>
                {session?.user?.name ?? 'Admin'}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--adm-t3)' }}>
                {session?.user?.email ?? 'Clinical Admin'}
              </div>
            </div>
            <UserCircle2 size={14} className="hidden lg:block ml-auto shrink-0" style={{ color: 'var(--adm-t3)' }} />
          </Link>

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all hover:bg-[rgba(255,68,68,0.08)] text-left group"
          >
            <LogOut size={15} className="shrink-0 transition-colors group-hover:text-red-400" style={{ color: 'var(--adm-t3)' }} />
            <span
              className="hidden lg:block text-[12px] font-medium transition-colors group-hover:text-red-400"
              style={{ color: 'var(--adm-t3)' }}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-5 px-7 h-[60px] shrink-0"
          style={{ borderBottom: '1px solid var(--adm-border)', background: 'rgba(8,13,26,0.8)', backdropFilter: 'blur(12px)' }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--adm-t1)' }}>
              {pathname === '/admin/profile'
                ? 'My Profile'
                : NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'Admin Dashboard'}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--adm-t3)' }}>
              {stats
                ? `${stats.totalPatients} patients · ${stats.onlineDevices} online · ${stats.activeAlerts} active alerts`
                : 'Al-Salam Care Center'}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="adm-live-dot" />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--adm-green)' }}>
                LIVE
              </span>
            </div>
            <span
              className="font-mono text-[12px]"
              style={{ color: 'var(--adm-t2)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {clock}
            </span>
          </div>
        </header>

        {/* Intercom strip */}
        {callActive && (
          <div
            className="flex items-center gap-3 px-7 py-2 shrink-0"
            style={{ background: 'rgba(26,115,232,0.12)', borderBottom: '1px solid rgba(26,115,232,0.25)' }}
          >
            <Radio size={14} style={{ color: 'var(--adm-blue)' }} />
            <span className="text-[12px] font-semibold" style={{ color: 'var(--adm-blue)' }}>
              Live Audio · {callRoom}
            </span>
            <span
              className="text-[11px] font-mono"
              style={{ color: 'var(--adm-t3)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {fmtSecs(callSecs)}
            </span>
            <button
              onClick={endCall}
              className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-md transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', color: 'var(--adm-t2)' }}
            >
              <PhoneOff size={12} />
              End Call
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
