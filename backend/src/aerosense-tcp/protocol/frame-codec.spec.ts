import { describe, expect, it } from '@jest/globals';
import {
  decodeFrame,
  encodeStatusResponse,
  extractFrames,
} from './frame-codec';

function wavveVitalFrame(): Buffer {
  const frame = Buffer.alloc(20);
  frame.writeUInt8(0x13, 0);
  frame.writeUInt8(0x01, 1);
  frame.writeUInt8(0x02, 2);
  frame.writeUInt8(0x01, 3);
  frame.writeUInt32BE(401, 4);
  frame.writeUInt16BE(10, 8);
  frame.writeUInt32BE(6, 10);
  frame.writeUInt16BE(0x03e8, 14);
  frame.writeUInt32BE(1, 16);
  return frame;
}

describe('AeroSense TCP frame codec', () => {
  it('reassembles and acknowledges a split Wavve frame', () => {
    const wire = wavveVitalFrame();
    const first = extractFrames(wire.subarray(0, 11));
    expect(first.frames).toEqual([]);

    const second = extractFrames(Buffer.concat([first.remainder, wire.subarray(11)]));
    expect(second.remainder).toEqual(Buffer.alloc(0));
    expect(second.frames).toEqual([wire]);

    const frame = decodeFrame(second.frames[0]);
    expect(frame).toMatchObject({
      protocol: 'wavve',
      type: 2,
      command: 1,
      requestId: 401,
      timeoutOrStatus: 10,
      functionCode: 0x03e8,
      data: Buffer.from([0, 0, 0, 1]),
    });

    const acknowledgement = encodeStatusResponse(frame, 1);
    expect(acknowledgement).toEqual(
      Buffer.from([
        0x13, 0x01, 0x00, 0x02,
        0x00, 0x00, 0x01, 0x91,
        0x00, 0x0a,
        0x00, 0x00, 0x00, 0x06,
        0x03, 0xe8,
        0x00, 0x00, 0x00, 0x01,
      ]),
    );
  });

  it('extracts coalesced Assure frames without consuming an incomplete tail', () => {
    const complete = Buffer.from([
      0x12, 0x01, 0x02, 0x01,
      0x00, 0x00, 0x00, 0x07,
      0x00, 0x00,
      0x00, 0x00, 0x00, 0x02,
      0x00, 0x1c,
    ]);
    const input = Buffer.concat([complete, complete, complete.subarray(0, 9)]);

    const result = extractFrames(input);

    expect(result.frames).toEqual([complete, complete]);
    expect(result.remainder).toEqual(complete.subarray(0, 9));
  });
});
