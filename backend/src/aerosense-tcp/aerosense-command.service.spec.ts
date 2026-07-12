import { describe, expect, it, jest } from '@jest/globals';
import { AeroSenseCommandService } from './aerosense-command.service';

describe('AeroSenseCommandService', () => {
  it('sends a validated Wavve report-interval command and accepts a success response', async () => {
    const response = { data: Buffer.from([0, 0, 0, 1]) };
    const sessions = { sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof response>>().mockResolvedValue(response) };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setWavveReportInterval('device-id', 60)).resolves.toBeUndefined();
    expect(sessions.sendCommand).toHaveBeenCalledWith('device-id', expect.objectContaining({
      protocol: 'wavve', functionCode: 0x03e9, data: Buffer.from([0, 0, 0, 60]),
    }));
  });

  it('rejects report intervals outside the vendor range', async () => {
    const service = new AeroSenseCommandService({} as never);
    await expect(service.setWavveReportInterval('device-id', 0)).rejects.toThrow('1..60000');
  });
});
