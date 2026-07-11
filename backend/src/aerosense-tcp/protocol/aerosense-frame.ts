export type AeroSenseProtocol = 'assure' | 'wavve';

export interface AeroSenseFrame {
  protocol: AeroSenseProtocol;
  type: 0 | 1 | 2;
  command: 0 | 1 | 2;
  requestId: number;
  timeoutOrStatus: number;
  functionCode: number;
  data: Buffer;
}

export type AeroSenseEvent =
  | {
      kind: 'registered';
      protocol: AeroSenseProtocol;
      externalId: string;
      firmwareVersion: string;
      radarType: number;
    }
  | {
      kind: 'wavve.vitals';
      deviceId: string;
      patientId: string;
      timestamp: number;
      heartRateBpm: number;
      respirationRateBrpm: number;
      validBit: 0 | 1 | 2;
      targetDistanceM: number;
      bedSignalStrength: number;
      breathCurve: number;
      heartCurve: number;
      bodyMoveEnergy: number;
      bodyMoveRange: number;
    }
  | {
      kind:
        | 'assure.fall'
        | 'assure.fall_eliminated'
        | 'assure.presence'
        | 'assure.position'
        | 'assure.wifi_signal'
        | 'wavve.alert'
        | 'wavve.movement';
      deviceId: string;
      patientId: string;
      timestamp: number;
      payload: Record<string, unknown>;
    };
