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

  it('reads the bounded Wavve report interval', async () => {
    const response = { data: Buffer.from([0, 0, 0, 20]) };
    const sessions = { sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof response>>().mockResolvedValue(response) };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.getWavveReportInterval('device-id')).resolves.toBe(20);
    expect(sessions.sendCommand).toHaveBeenCalledWith('device-id', expect.objectContaining({
      protocol: 'wavve', functionCode: 0x03ea, data: Buffer.alloc(4),
    }));
  });

  it('sends a Wavve bed-exit timer command only for supported values', async () => {
    const response = { data: Buffer.from([0, 0, 0, 1]) };
    const sessions = { sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof response>>().mockResolvedValue(response) };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setWavveBedExitTimer('device-id', 30)).resolves.toBeUndefined();
    expect(sessions.sendCommand).toHaveBeenCalledWith('device-id', expect.objectContaining({
      protocol: 'wavve', functionCode: 0x0404, data: Buffer.from([0, 0, 0, 30]),
    }));
    await expect(service.setWavveBedExitTimer('device-id', 29)).rejects.toThrow('0 or 30..86400');
  });

  it('reads a Wavve bed-exit timer including the explicitly disabled value', async () => {
    const response = { data: Buffer.alloc(4) };
    const sessions = { sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof response>>().mockResolvedValue(response) };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.getWavveBedExitTimer('device-id')).resolves.toBe(0);
    expect(sessions.sendCommand).toHaveBeenCalledWith('device-id', expect.objectContaining({
      protocol: 'wavve', functionCode: 0x0405, data: Buffer.alloc(4),
    }));
  });

  it('sets and reads Assure installation height as a bounded big-endian float', async () => {
    const setResponse = { data: Buffer.from([0, 0, 0, 1]) };
    const getResponse = { data: Buffer.from([0x3f, 0xe6, 0x66, 0x66]) };
    const sessions = {
      sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof setResponse | typeof getResponse>>()
        .mockResolvedValueOnce(setResponse)
        .mockResolvedValueOnce(getResponse),
    };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setAssureInstallationHeight('device-id', 1.8)).resolves.toBeUndefined();
    await expect(service.getAssureInstallationHeight('device-id')).resolves.toBeCloseTo(1.8, 4);
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(1, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0002, data: Buffer.from([0x3f, 0xe6, 0x66, 0x66]),
    }));
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(2, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0003, data: Buffer.alloc(4),
    }));
    await expect(service.setAssureInstallationHeight('device-id', 1.3)).rejects.toThrow('1.4..2.2');
  });

  it('sets and reads Assure fall-buffer time within the documented range', async () => {
    const setResponse = { data: Buffer.from([0, 0, 0, 1]) };
    const getResponse = { data: Buffer.from([0, 0, 0, 60]) };
    const sessions = {
      sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof setResponse | typeof getResponse>>()
        .mockResolvedValueOnce(setResponse)
        .mockResolvedValueOnce(getResponse),
    };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setAssureFallBufferTime('device-id', 60)).resolves.toBeUndefined();
    await expect(service.getAssureFallBufferTime('device-id')).resolves.toBe(60);
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(1, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0004, data: Buffer.from([0, 0, 0, 60]),
    }));
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(2, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0005, data: Buffer.alloc(4),
    }));
    await expect(service.setAssureFallBufferTime('device-id', 301)).rejects.toThrow('30..300');
  });

  it('sets and reads Assure working range only within the documented limits', async () => {
    const setResponse = { data: Buffer.from([0, 0, 0, 1]) };
    const getResponse = { data: Buffer.from([0x40, 0x80, 0x00, 0x00]) };
    const sessions = {
      sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof setResponse | typeof getResponse>>()
        .mockResolvedValueOnce(setResponse)
        .mockResolvedValueOnce(getResponse),
    };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setAssureWorkingRange('device-id', 4)).resolves.toBeUndefined();
    await expect(service.getAssureWorkingRange('device-id')).resolves.toBe(4);
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(1, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0006, data: Buffer.from([0x40, 0x80, 0x00, 0x00]),
    }));
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(2, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x0007, data: Buffer.alloc(4),
    }));
    await expect(service.setAssureWorkingRange('device-id', 7.1)).rejects.toThrow('1..7');
  });

  it('sets and reads an Assure fall-detection mode without accepting an unknown mode', async () => {
    const setResponse = { data: Buffer.from([0, 0, 0, 1]) };
    const getResponse = { data: Buffer.from([0, 0, 0, 1]) };
    const sessions = {
      sendCommand: jest.fn<(...args: unknown[]) => Promise<typeof setResponse | typeof getResponse>>()
        .mockResolvedValueOnce(setResponse)
        .mockResolvedValueOnce(getResponse),
    };
    const service = new AeroSenseCommandService(sessions as never);

    await expect(service.setAssureFallMode('device-id', 'low_false_alert')).resolves.toBeUndefined();
    await expect(service.getAssureFallMode('device-id')).resolves.toBe('low_false_alert');
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(1, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x001e, data: Buffer.from([0, 0, 0, 1]),
    }));
    expect(sessions.sendCommand).toHaveBeenNthCalledWith(2, 'device-id', expect.objectContaining({
      protocol: 'assure', functionCode: 0x001f, data: Buffer.alloc(4),
    }));
  });
});
