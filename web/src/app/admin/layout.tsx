'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminStore } from '@/lib/admin-store';
import { getAdminStats, getAdminPatients, getAdminActiveAlerts } from '@/lib/api';
import { MOCK_STATS, MOCK_PATIENTS, MOCK_ACTIVE_ALERTS } from '@/lib/mock-data';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function nudge(v: number, range: number) { return v + (Math.random() * range * 2 - range); }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { setPatients, setStats, setActiveAlerts, upsertVital, vitalsSocket } = useAdminStore();

  // Role gate — only admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.replace('/roster');
    }
  }, [status, session, router]);

  // Seed with mock data immediately so the UI is never blank, then overlay real data
  useEffect(() => {
    setStats(MOCK_STATS);
    setPatients(MOCK_PATIENTS);
    setActiveAlerts(MOCK_ACTIVE_ALERTS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vital drift simulation — runs only when no real socket is connected
  useEffect(() => {
    const id = setInterval(() => {
      if (vitalsSocket?.connected) return;
      const patients = useAdminStore.getState().patients;
      patients
        .filter((p) => p.deviceStatus === 'online' && p.latestHr !== null)
        .forEach((p) => {
          upsertVital(p.id, {
            hr:      Math.round(clamp(nudge(p.latestHr!, 2), 40, 130)),
            rr:      Math.round(clamp(nudge(p.latestRr ?? 16, 1), 6, 30)),
            quality: Math.min(1, Math.max(0.2, (p.signalQuality ?? 0.8) + (Math.random() * 0.04 - 0.02))),
            ts:      new Date().toISOString(),
          });
        });
    }, 2500);
    return () => clearInterval(id);
  }, [upsertVital, vitalsSocket]);

  // Replace mock data with live data when authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([getAdminStats(), getAdminPatients(), getAdminActiveAlerts()])
      .then(([stats, patients, alerts]) => {
        setStats(stats);
        setPatients(patients);
        setActiveAlerts(alerts);
      })
      .catch(() => {}); // keep showing mock data on API failure
  }, [status, setStats, setPatients, setActiveAlerts]);

  if (status === 'loading') {
    return (
      <div
        className="adm-shell flex items-center justify-center h-screen"
        style={{ background: 'var(--adm-bg)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--adm-blue)' }}
        />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return <AdminShell>{children}</AdminShell>;
}
