import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { Config } from '../config/config.schema';

@Injectable()
export class IntercomService {
  private readonly roomService: RoomServiceClient;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly prisma: PrismaService,
  ) {
    this.roomService = new RoomServiceClient(
      this.config.get('LIVEKIT_API_URL'),   // HTTP endpoint for Twirp RPC
      this.config.get('LIVEKIT_API_KEY'),
      this.config.get('LIVEKIT_API_SECRET'),
    );
  }

  async createRoom(patientUuid: string) {
    return this.roomService.createRoom({
      name: `patient-${patientUuid}`,
      emptyTimeout: 14400,
    });
  }

  async issueToken(
    patientId: string,
    participantIdentity: string,
    canPublish: boolean,
    canSubscribe: boolean,
  ) {
    const at = new AccessToken(
      this.config.get('LIVEKIT_API_KEY'),
      this.config.get('LIVEKIT_API_SECRET'),
      { identity: participantIdentity },
    );
    at.addGrant({
      roomJoin: true,
      room: `patient-${patientId}`,
      canPublish,
      canSubscribe,
    });
    return { token: at.toJwt(), wsUrl: this.config.get('LIVEKIT_WS_URL') };
  }

  async requestToken(caregiverId: string, patientId: string) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, patientId },
    });
    if (!link) throw new ForbiddenException('Not linked to this patient');
    return this.issueToken(patientId, `caregiver-${caregiverId}`, true, true);
  }

  async logSession(alertEventId: string | undefined, livekitRoomId: string, initiatedBy: string) {
    return this.prisma.intercomSession.create({
      data: { alertEventId, livekitRoomId, initiatedBy },
    });
  }

  async endSession(livekitRoomToken: string, durationSeconds: number, caregiverId: string) {
    const session = await this.prisma.intercomSession.findFirst({
      where: { livekitRoomId: livekitRoomToken, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return { ok: true };

    return this.prisma.intercomSession.update({
      where: { id: session.id },
      data: { endedAt: new Date(), durationSeconds },
    });
  }
}
