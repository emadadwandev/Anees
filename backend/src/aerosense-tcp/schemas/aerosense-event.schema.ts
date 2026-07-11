import { z } from 'zod';

const finiteNumber = z.number().finite();

export const AeroSenseEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('registered'),
    protocol: z.enum(['assure', 'wavve']),
    externalId: z.string(),
    firmwareVersion: z.string(),
    radarType: finiteNumber,
  }),
  z.object({
    kind: z.literal('wavve.vitals'),
    deviceId: z.string().uuid(),
    patientId: z.string().uuid(),
    timestamp: finiteNumber,
    heartRateBpm: finiteNumber,
    respirationRateBrpm: finiteNumber,
    validBit: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    targetDistanceM: finiteNumber,
    bedSignalStrength: finiteNumber,
    breathCurve: finiteNumber,
    heartCurve: finiteNumber,
    bodyMoveEnergy: finiteNumber,
    bodyMoveRange: finiteNumber,
  }),
  z.object({
    kind: z.enum([
      'assure.fall',
      'assure.fall_eliminated',
      'assure.presence',
      'assure.position',
      'assure.wifi_signal',
      'wavve.alert',
      'wavve.movement',
    ]),
    deviceId: z.string().uuid(),
    patientId: z.string().uuid(),
    timestamp: finiteNumber,
    payload: z.record(z.unknown()),
  }),
]);
