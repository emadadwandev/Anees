'use client';

import { useEffect } from 'react';
import { useAlertStore } from '@/lib/store';
import { useSocket } from '@/lib/socket';
import type { FallDetected, AlertStateChange, AlertEvent } from '@/lib/types';

export function useAlerts() {
  const socket = useSocket();
  const { activeAlerts, unreadCount, addAlert, updateAlertState, clearUnread } =
    useAlertStore();

  useEffect(() => {
    if (!socket) return;

    const onFall = (event: FallDetected, ack?: () => void) => {
      const alert: AlertEvent = {
        id: event.alertId,
        patientId: event.patientId,
        patientRoom: event.room,
        type: 'fall',
        status: 'dispatched',
        triggeredAt: event.detectedAt,
      };
      addAlert(alert);

      // Play alarm sound if tab not focused
      if (document.visibilityState === 'hidden') {
        try {
          const audio = new Audio('/sounds/alert.mp3');
          audio.loop = false;
          audio.play().catch(() => {});
        } catch {
          // browser autoplay policy — ignore
        }
      }

      if (typeof ack === 'function') ack();
    };

    const onStateChange = (event: AlertStateChange) => {
      updateAlertState(event.alertId, event.state);
    };

    socket.on('fall.detected', onFall);
    socket.on('alert.state_changed', onStateChange);

    return () => {
      socket.off('fall.detected', onFall);
      socket.off('alert.state_changed', onStateChange);
    };
  }, [socket, addAlert, updateAlertState]);

  return { activeAlerts, unreadCount, clearUnread };
}
