import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressInfo, BlockList, createServer, isIP, Server, Socket } from 'net';
import { Config } from '../config/config.schema';
import { MetricsService } from '../metrics/metrics.service';
import { AeroSenseEventService, WavveClinicalAlertKind } from './aerosense-event.service';
import { decodeAssureEvent } from './protocol/assure-codec';
import { decodeFrame, encodeStatusResponse, extractFrames } from './protocol/frame-codec';
import { decodeWavveAlertEvent } from './protocol/wavve-alert-codec';
import { decodeWavveVitalData } from './protocol/wavve-codec';
import { AeroSenseSessionService } from './aerosense-session.service';

const WAVVE_CLINICAL_ALERT_KINDS = new Set<WavveClinicalAlertKind>([
  'vital.no_breath', 'vital.low_breath', 'vital.high_breath',
  'vital.no_heart', 'vital.low_heart', 'vital.high_heart',
]);

function isWavveClinicalAlertKind(kind: string): kind is WavveClinicalAlertKind {
  return WAVVE_CLINICAL_ALERT_KINDS.has(kind as WavveClinicalAlertKind);
}

@Injectable()
export class AeroSenseTcpServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AeroSenseTcpServerService.name);
  private readonly sockets = new Set<Socket>();
  private allowedNetworks?: BlockList;
  private server?: Server;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly sessions: AeroSenseSessionService,
    private readonly events: AeroSenseEventService,
    private readonly metrics?: MetricsService,
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
    if (!this.isAddressAllowed(socket.remoteAddress ?? '')) {
      this.logger.warn(`Rejected AeroSense TCP connection from ${socket.remoteAddress ?? 'unknown address'}`);
      socket.destroy();
      return;
    }
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
        for (const wire of extracted.frames) {
          void this.handleFrame(socket, wire).catch((error) => {
            this.logger.warn(error, 'Rejected AeroSense TCP event');
            socket.destroy();
          });
        }
      } catch (error) {
        this.metrics?.tcpFramesRejected.inc({ protocol: 'unknown', reason: 'invalid_frame' });
        this.logger.warn(error, 'Rejected invalid AeroSense TCP frame');
        socket.destroy();
      }
    });
  }

  private isAddressAllowed(address: string): boolean {
    const configured = this.config.get('TCP_ALLOWED_CIDRS')?.trim() ?? '';
    if (!configured) return true;

    if (!this.allowedNetworks) {
      this.allowedNetworks = new BlockList();
      for (const cidr of configured.split(',').map((value) => value.trim()).filter(Boolean)) {
        const [network, prefixText] = cidr.split('/');
        const family = isIP(network);
        const prefix = Number(prefixText);
        const maxPrefix = family === 4 ? 32 : 128;
        if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
          throw new Error(`Invalid TCP allowed CIDR: ${cidr}`);
        }
        this.allowedNetworks.addSubnet(network, prefix, family === 4 ? 'ipv4' : 'ipv6');
      }
    }

    const family = isIP(address);
    return family === 4 || family === 6
      ? this.allowedNetworks.check(address, family === 4 ? 'ipv4' : 'ipv6')
      : false;
  }

  private async handleFrame(socket: Socket, wire: Buffer): Promise<void> {
    const frame = decodeFrame(wire);
    const labels = { protocol: frame.protocol, function_code: `0x${frame.functionCode.toString(16).padStart(4, '0')}` };
    const startedAt = performance.now();
    this.metrics?.tcpFramesReceived.inc(labels);
    try {
    const isRegistration =
      (frame.protocol === 'wavve' && frame.functionCode === 0x0001) ||
      (frame.protocol === 'assure' && frame.functionCode === 0x0012);
    if (isRegistration) {
      const registered = await this.sessions.register(socket, frame);
      socket.write(encodeStatusResponse(frame, registered ? 1 : 0));
      return;
    }

    const session = this.sessions.getSession(socket);
    if (!session) {
      throw new Error('AeroSense event received before sensor registration');
    }

    if (frame.protocol === 'assure') {
      const event = decodeAssureEvent(frame);
      if (event?.kind === 'fall') {
        await this.events.handleAssureFall(session, event, Date.now());
        socket.write(encodeStatusResponse(frame, 1));
      } else if (event?.kind === 'fall_eliminated') {
        await this.events.handleAssureFallElimination(session);
        socket.write(encodeStatusResponse(frame, 1));
      } else if (event?.kind === 'presence') {
        await this.events.handleAssurePresence(session, event, Date.now());
        socket.write(encodeStatusResponse(frame, 1));
      } else if (event?.kind === 'position') {
        await this.events.handleAssurePosition(session, event, Date.now());
      }
      return;
    }

    if (frame.protocol !== 'wavve') return;
    if (frame.functionCode === 0x03e8) {
      await this.events.handleWavveVital(session, decodeWavveVitalData(frame.data), Date.now());
      return;
    }

    const alert = decodeWavveAlertEvent(frame);
    if (alert && isWavveClinicalAlertKind(alert.kind)) {
      await this.events.handleWavveClinicalAlert(session, alert.kind, Date.now());
    } else if (alert) {
      await this.events.handleWavveObservation(session, alert, Date.now());
    }
    } finally {
      this.metrics?.tcpHandlerDuration.observe(labels, (performance.now() - startedAt) / 1000);
    }
  }
}
