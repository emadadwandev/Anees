import axios from 'axios';
import { describe, expect, it, jest } from '@jest/globals';
import { MqttConsumerService } from './mqtt-consumer.service';

describe('MqttConsumerService assignment handling', () => {
  it('does not forward unassigned device payloads to clinical DSP processing', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} } as never);
    const service = new MqttConsumerService(
      { get: jest.fn() } as never,
      {
        resolveDeviceById: jest.fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue({ id: 'device-1', userId: null }),
      } as never,
      {
        mqttMessagesReceived: { inc: jest.fn() },
        dspProcessDuration: { startTimer: jest.fn(() => jest.fn()) },
        mqttForwardFailures: { inc: jest.fn() },
      } as never,
      { add: jest.fn() } as never,
    );

    await (service as any).handleMessage(
      'anees/devices/00000000-0000-0000-0000-000000000001/raw',
      JSON.stringify({
        device_id: '00000000-0000-0000-0000-000000000001',
        timestamp: 1,
        frame_seq: 1,
        point_cloud: [{ x: 0, y: 0, z: 0, v: 0, snr: 0.5 }],
        firmware_version: '1.0.0',
      }),
    );

    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });
});
