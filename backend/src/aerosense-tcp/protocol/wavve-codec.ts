export interface WavveVitalData {
  respirationRateBrpm: number;
  breathCurve: number;
  heartRateBpm: number;
  heartCurve: number;
  targetDistanceM: number;
  bedSignalStrength: number;
  validBit: 0 | 1 | 2;
  bodyMoveEnergy: number;
  bodyMoveRange: number;
}

const WAVVE_VITAL_DATA_BYTES = 36;

export function decodeWavveVitalData(payload: Buffer): WavveVitalData {
  if (payload.length !== WAVVE_VITAL_DATA_BYTES) {
    throw new Error(`Invalid Wavve vital payload length: ${payload.length}`);
  }

  // The Wavve PDF labels valid_bit as Uint8, but its wire example reserves four bytes.
  const validBit = payload.readUInt32BE(24);
  if (validBit !== 0 && validBit !== 1 && validBit !== 2) {
    throw new Error(`Invalid Wavve validity value: ${validBit}`);
  }

  const values: WavveVitalData = {
    respirationRateBrpm: payload.readFloatBE(0),
    breathCurve: payload.readFloatBE(4),
    heartRateBpm: payload.readFloatBE(8),
    heartCurve: payload.readFloatBE(12),
    targetDistanceM: payload.readFloatBE(16),
    bedSignalStrength: payload.readFloatBE(20),
    validBit,
    bodyMoveEnergy: payload.readFloatBE(28),
    bodyMoveRange: payload.readFloatBE(32),
  };

  if (Object.values(values).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('Wavve vital payload contains a non-finite value');
  }

  return values;
}
