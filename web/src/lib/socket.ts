'use client';

import { io, Socket } from 'socket.io-client';
import type {
  VitalsUpdate,
  FallDetected,
  AlertStateChange,
  DeviceOffline,
} from './types';
import { useAlertStore } from './store';

export function createSocket(token: string): Socket {
  const socket = io(
    `${process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000'}/caregiver`,
    {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    },
  );
  return socket;
}

export type { VitalsUpdate, FallDetected, AlertStateChange, DeviceOffline };

export function useSocket(): Socket | null {
  return useAlertStore((s) => s.socket);
}
