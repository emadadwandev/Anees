import { AeroSenseFrame, AeroSenseProtocol } from './aerosense-frame';

export const AEROSENSE_HEADER_BYTES = 14;
export const AEROSENSE_MAX_CONTENT_BYTES = 4096;

const MAGIC_TO_PROTOCOL: Record<number, AeroSenseProtocol> = {
  0x12: 'assure',
  0x13: 'wavve',
};

function readContentLength(header: Buffer): number {
  return header.readUInt32BE(10);
}

function validateHeader(header: Buffer): void {
  if (!(header[0] in MAGIC_TO_PROTOCOL)) {
    throw new Error(`Unsupported AeroSense magic byte: 0x${header[0].toString(16)}`);
  }
  if (header[1] !== 0x01) {
    throw new Error(`Unsupported AeroSense protocol version: ${header[1]}`);
  }
  if (![0, 1, 2].includes(header[2]) || ![0, 1, 2].includes(header[3])) {
    throw new Error('Invalid AeroSense frame type or command');
  }

  const contentLength = readContentLength(header);
  if (contentLength < 2 || contentLength > AEROSENSE_MAX_CONTENT_BYTES) {
    throw new Error(`Invalid AeroSense content length: ${contentLength}`);
  }
}

export function extractFrames(buffer: Buffer): { frames: Buffer[]; remainder: Buffer } {
  const frames: Buffer[] = [];
  let offset = 0;

  while (buffer.length - offset >= AEROSENSE_HEADER_BYTES) {
    const header = buffer.subarray(offset, offset + AEROSENSE_HEADER_BYTES);
    validateHeader(header);

    const frameLength = AEROSENSE_HEADER_BYTES + readContentLength(header);
    if (buffer.length - offset < frameLength) break;

    frames.push(buffer.subarray(offset, offset + frameLength));
    offset += frameLength;
  }

  return { frames, remainder: buffer.subarray(offset) };
}

export function decodeFrame(wire: Buffer): AeroSenseFrame {
  if (wire.length < AEROSENSE_HEADER_BYTES) {
    throw new Error('AeroSense frame is shorter than its header');
  }

  const header = wire.subarray(0, AEROSENSE_HEADER_BYTES);
  validateHeader(header);

  const contentLength = readContentLength(header);
  if (wire.length !== AEROSENSE_HEADER_BYTES + contentLength) {
    throw new Error(`AeroSense frame length mismatch: expected ${AEROSENSE_HEADER_BYTES + contentLength}, received ${wire.length}`);
  }

  const protocol = MAGIC_TO_PROTOCOL[header[0]];
  const content = wire.subarray(AEROSENSE_HEADER_BYTES);
  return {
    protocol,
    type: header[2] as 0 | 1 | 2,
    command: header[3] as 0 | 1 | 2,
    requestId: header.readUInt32BE(4),
    timeoutOrStatus: header.readUInt16BE(8),
    functionCode: content.readUInt16BE(0),
    data: content.subarray(2),
  };
}

export function encodeStatusResponse(frame: AeroSenseFrame, status: 0 | 1): Buffer {
  const magic = frame.protocol === 'assure' ? 0x12 : 0x13;
  const response = Buffer.alloc(AEROSENSE_HEADER_BYTES + 6);
  response.writeUInt8(magic, 0);
  response.writeUInt8(0x01, 1);
  response.writeUInt8(0x00, 2);
  response.writeUInt8(0x02, 3);
  response.writeUInt32BE(frame.requestId, 4);
  response.writeUInt16BE(frame.timeoutOrStatus, 8);
  response.writeUInt32BE(6, 10);
  response.writeUInt16BE(frame.functionCode, 14);
  response.writeUInt32BE(status, 16);
  return response;
}

export function encodeCommandRequest(frame: Pick<AeroSenseFrame, 'protocol' | 'requestId' | 'timeoutOrStatus' | 'functionCode' | 'data'>): Buffer {
  const contentLength = 2 + frame.data.length;
  const request = Buffer.alloc(AEROSENSE_HEADER_BYTES + contentLength);
  request.writeUInt8(frame.protocol === 'assure' ? 0x12 : 0x13, 0);
  request.writeUInt8(0x01, 1);
  request.writeUInt8(0x01, 2);
  request.writeUInt8(0x01, 3);
  request.writeUInt32BE(frame.requestId, 4);
  request.writeUInt16BE(frame.timeoutOrStatus, 8);
  request.writeUInt32BE(contentLength, 10);
  request.writeUInt16BE(frame.functionCode, 14);
  frame.data.copy(request, 16);
  return request;
}
