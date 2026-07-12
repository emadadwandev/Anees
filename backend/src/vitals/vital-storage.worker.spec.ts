import { describe, expect, it, jest } from '@jest/globals';
import { VitalStorageWorker } from './vital-storage.worker';

describe('VitalStorageWorker input validation', () => {
  it('discards an out-of-range vital reading before it reaches the storage buffer', () => {
    let onMessage!: (_pattern: string, channel: string, message: string) => void;
    const subscriber = {
      psubscribe: jest.fn(),
      on: jest.fn((event: string, handler: typeof onMessage) => {
        if (event === 'pmessage') onMessage = handler;
      }),
    };
    const redis = { duplicate: jest.fn().mockReturnValue(subscriber) };
    const worker = new VitalStorageWorker({} as never, redis as never, {} as never);

    try {
      worker.onModuleInit();
      onMessage('vitals:*', 'vitals:patient-id', JSON.stringify({
        device_id: 'device-id', patient_id: 'patient-id', timestamp: Date.now(),
        heart_rate_bpm: 251, resp_rate_brpm: 16, signal_quality: 1,
      }));

      expect((worker as any).buffer).toEqual([]);
    } finally {
      clearInterval((worker as any).flushTimer);
    }
  });
});
