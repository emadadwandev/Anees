import { Buffer } from 'node:buffer';

export const WAVVE_E2E_RADAR_ID = '13CECDA0000040C11D13155507';

function encodeWavveFrame(functionCode: number, data: Buffer, requestId: number): Buffer {
  const contentLength = 2 + data.length;
  const frame = Buffer.alloc(14 + contentLength);
  frame.writeUInt8(0x13, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x01, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(requestId, 4);
  frame.writeUInt16BE(10_000, 8);
  frame.writeUInt32BE(contentLength, 10);
  frame.writeUInt16BE(functionCode, 14);
  data.copy(frame, 16);
  return frame;
}

export function wavveRegistrationFrame(): Buffer {
  return encodeWavveFrame(
    0x0001,
    Buffer.concat([
      Buffer.from([0x01, 0x02, 0x08, 0x02, 0x03]),
      Buffer.from(WAVVE_E2E_RADAR_ID, 'hex'),
    ]),
    1,
  );
}

export function wavveVitalFrame(): Buffer {
  return encodeWavveFrame(
    0x03e8,
    Buffer.from([
      0x41, 0x3b, 0x80, 0x00,
      0x3e, 0x1c, 0x0b, 0xc0,
      0x42, 0x96, 0x00, 0x00,
      0xbe, 0xdb, 0xa4, 0xf6,
      0x3f, 0xc0, 0x00, 0x00,
      0x42, 0x0f, 0xa6, 0x20,
      0x00, 0x00, 0x00, 0x02,
      0x41, 0xb3, 0xc7, 0x13,
      0x40, 0x53, 0x33, 0x34,
    ]),
    2,
  );
}
