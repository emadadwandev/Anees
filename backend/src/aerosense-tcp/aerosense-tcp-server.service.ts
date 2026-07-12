import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressInfo, createServer, Server, Socket } from 'net';
import { Config } from '../config/config.schema';
import { decodeFrame, encodeStatusResponse, extractFrames } from './protocol/frame-codec';
import { AeroSenseSessionService } from './aerosense-session.service';

@Injectable()
export class AeroSenseTcpServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AeroSenseTcpServerService.name);
  private readonly sockets = new Set<Socket>();
  private server?: Server;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly sessions: AeroSenseSessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  isListening(): boolean {
    return this.server?.listening ?? false;
  }

  async start(): Promise<number> {
    if (this.server?.listening) {
      const address = this.server.address() as AddressInfo;
      return address.port;
    }

    this.server = createServer((socket) => this.handleConnection(socket));
    this.server.on('error', (error) => this.logger.error(error, 'AeroSense TCP listener error'));

    const host = this.config.get('TCP_BIND_HOST')!;
    const port = this.config.get('TCP_PORT')!;
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, host, () => {
        this.server!.off('error', reject);
        resolve();
      });
    });

    const address = this.server.address() as AddressInfo;
    this.logger.log(`AeroSense TCP listener active on ${address.address}:${address.port}`);
    return address.port;
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();

    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private handleConnection(socket: Socket): void {
    this.sockets.add(socket);
    socket.setTimeout(this.config.get('TCP_IDLE_TIMEOUT_MS')!);
    socket.once('timeout', () => socket.destroy());
    socket.once('close', () => {
      this.sockets.delete(socket);
      this.sessions.unregister(socket);
    });
    socket.on('error', (error) => this.logger.warn(error, 'AeroSense TCP socket error'));

    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const extracted = extractFrames(buffer);
        buffer = extracted.remainder;
        for (const wire of extracted.frames) void this.handleFrame(socket, wire);
      } catch (error) {
        this.logger.warn(error, 'Rejected invalid AeroSense TCP frame');
        socket.destroy();
      }
    });
  }

  private async handleFrame(socket: Socket, wire: Buffer): Promise<void> {
    const frame = decodeFrame(wire);
    if (frame.functionCode !== 0x0001) return;

    const registered = await this.sessions.register(socket, frame);
    socket.write(encodeStatusResponse(frame, registered ? 1 : 0));
  }
}
