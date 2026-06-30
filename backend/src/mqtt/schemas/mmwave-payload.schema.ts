import { z } from 'zod';

export const PointCloudEntrySchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  v: z.number(),
  snr: z.number().min(0).max(1),
});

export const MmWaveRawPayloadSchema = z.object({
  device_id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  frame_seq: z.number().int().nonnegative(),
  point_cloud: z.array(PointCloudEntrySchema).min(1),
  firmware_version: z.string().regex(/^\d+\.\d+\.\d+$/),
});

export type MmWaveRawPayload = z.infer<typeof MmWaveRawPayloadSchema>;
