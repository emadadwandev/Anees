import { z } from 'zod';

// Hardware publishes all property values as strings
export const RadarPostMessageSchema = z.object({
  version: z.string(),
  method: z.enum(['post']),
  params: z.record(z.string()),
});

export const RadarQueryResponseSchema = z.object({
  version: z.string(),
  opt: z.enum(['get', 'set', 'limit_get', 'limit_set', 'qos_get', 'qos_set']),
  res: z.enum(['success', 'fail']),
  params: z.record(z.string()).optional(),
});

export const RadarUpstreamMessageSchema = z.union([
  RadarPostMessageSchema,
  RadarQueryResponseSchema,
]);

export type RadarPostMessage = z.infer<typeof RadarPostMessageSchema>;
export type RadarUpstreamMessage = z.infer<typeof RadarUpstreamMessageSchema>;
