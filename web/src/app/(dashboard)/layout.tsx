'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useAlertStore } from '@/lib/store';
import { createSocket } from '@/lib/socket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const setSocket       = useAlertStore((s) => s.setSocket);
  const addAlert        = useAlertStore((s) => s.addAlert);
  const updateAlertState = useAlertStore((s) => s.updateAlertState);
  const updateVitals    = useAlertStore((s) => s.updateVitals);
  const markOffline     = useAlertStore((s) => s.markDeviceOffline);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Socket.IO — /caregiver namespace (CaregiverGateway)
  useEffect(() => {
    if (!session?.accessToken) return;

    const socket = createSocket(session.accessToken);
    setSocket(socket);

    // ── Fall alerts ────────────────────────────────────────────────────────────
    // PRD US-B02: push notification arrives within 12 s, alert surfaced immediately
    socket.on('fall.detected', (event, ack) => {
      addAlert({
        id: event.alertId,
        patientId: event.patientId,
        patientRoom: event.room,
        type: 'fall',
        status: 'dispatched',
        triggeredAt: event.detectedAt,
      });
      // ACK required — confirms BullMQ grace-timer cancellation window (PRD §5)
      if (typeof ack === 'function') ack();
      toast.error(`Fall detected — ${event.room}`, {
        duration: Infinity,
        action: {
          label: 'View',
          onClick: () => router.push(`/alerts/${event.alertId}`),
        },
      });
    });

    // ── Alert state transitions ────────────────────────────────────────────────
    socket.on('alert.state_changed', (event) => {
      updateAlertState(event.alertId, event.state);
    });

    // ── Live vitals (for roster HR/RR cards) ──────────────────────────────────
    // PRD US-B05: "list auto-refreshes via WebSocket — no manual pull-to-refresh"
    socket.on('vitals.update', (event) => {
      updateVitals({
        patientId: event.patientId,
        hr: event.hr,
        rr: event.rr,
        timestamp: event.timestamp,
        quality: event.quality,
      });
    });

    // ── Device health ──────────────────────────────────────────────────────────
    // PRD US-B06: "push notification sent to caregiver when device goes offline > 15 min"
    socket.on('system.device_offline', (event) => {
      markOffline({
        deviceId: event.deviceId,
        patientId: event.patientId,
        lastSeen: event.lastSeen,
        offlineSince: new Date().toISOString(),
      });
      toast.warning(`Sensor offline — patient room unavailable`, { duration: 8000 });
    });

    // Device back online — clear the offline badge
    socket.on('system.heartbeat_warning', (event) => {
      // Treat a heartbeat warning as still-online but degraded — keep device in map
      toast.warning(`Sensor heartbeat delayed — ${event.deviceId}`, { duration: 5000 });
    });

    socket.on('system.occlusion', (_event) => {
      toast.warning('Sensor occlusion detected — check device placement', { duration: 8000 });
    });

    // Vital dwell alarm (HR/RR out of threshold for sustained period)
    socket.on('vital.dwell_alarm', (event) => {
      addAlert({
        id: event.alertId,
        patientId: event.patientId,
        patientRoom: event.room ?? '',
        type: 'vital_anomaly',
        status: 'dispatched',
        triggeredAt: event.detectedAt ?? new Date().toISOString(),
      });
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  if (status === 'loading') {
    return (
      <div
        className="adm-shell min-h-screen flex items-center justify-center"
        style={{ background: 'var(--adm-bg)' }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--adm-blue)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="adm-shell flex h-screen overflow-hidden" style={{ background: 'var(--adm-bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
