'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/socket';
import type { VitalsUpdate } from '@/lib/types';
import axios from 'axios';
import { getSession } from 'next-auth/react';

interface VitalsState {
  hr: number | null;
  rr: number | null;
  quality: number | null;
  lastUpdated: Date | null;
  isLive: boolean;
}

export function useVitals(patientId: string): VitalsState {
  const socket = useSocket();
  const [state, setState] = useState<VitalsState>({
    hr: null,
    rr: null,
    quality: null,
    lastUpdated: null,
    isLive: false,
  });

  const fetchFallback = useCallback(async () => {
    try {
      const session = await getSession();
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/patients/${patientId}/vitals/live`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } },
      );
      setState({
        hr: data.heartRateBpm,
        rr: data.respRateBrpm,
        quality: data.signalQuality,
        lastUpdated: new Date(data.time),
        isLive: false,
      });
    } catch {
      // silent fallback failure
    }
  }, [patientId]);

  useEffect(() => {
    if (!socket) {
      fetchFallback();
      return;
    }

    const handler = (update: VitalsUpdate) => {
      if (update.patientId !== patientId) return;
      setState({
        hr: update.hr,
        rr: update.rr,
        quality: update.quality,
        lastUpdated: new Date(update.timestamp),
        isLive: true,
      });
    };

    socket.on('vitals.update', handler);
    fetchFallback();

    return () => {
      socket.off('vitals.update', handler);
    };
  }, [socket, patientId, fetchFallback]);

  return state;
}
