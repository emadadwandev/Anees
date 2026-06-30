import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { RelationshipType } from '@prisma/client';
import { randomBytes } from 'crypto';

const INVITE_TTL = 86400;

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async generateInvite(caregiverId: string): Promise<{ code: string; expiresInSeconds: number }> {
    const code = randomBytes(6).toString('hex').toUpperCase();
    await this.redis.set(`invite:${code}`, caregiverId, 'EX', INVITE_TTL);
    return { code, expiresInSeconds: INVITE_TTL };
  }

  async acceptInvite(code: string, patientId: string) {
    const caregiverId = await this.redis.get(`invite:${code}`);
    if (!caregiverId) throw new BadRequestException('Invite code invalid or expired');

    const existing = await this.prisma.caregiverLink.findFirst({ where: { caregiverId, patientId } });
    if (existing) throw new ConflictException('Already linked');

    const existingLinks = await this.prisma.caregiverLink.count({ where: { patientId } });
    const isPrimary = existingLinks === 0;

    const link = await this.prisma.caregiverLink.create({
      data: {
        caregiverId,
        patientId,
        relationshipType: isPrimary ? RelationshipType.primary : RelationshipType.secondary,
        isPrimary,
      },
    });

    await this.redis.del(`invite:${code}`);

    await this.prisma.auditLog.create({
      data: {
        actorId: patientId,
        action: 'link.created',
        resourceType: 'caregiver_link',
        resourceId: link.id,
      },
    });

    return link;
  }

  async getPatients(caregiverId: string) {
    return this.prisma.caregiverLink.findMany({
      where: { caregiverId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, language: true, avatarUrl: true },
        },
      },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async updateLink(linkId: string, caregiverId: string, relationshipType: RelationshipType) {
    const link = await this.prisma.caregiverLink.findFirst({ where: { id: linkId, caregiverId } });
    if (!link) throw new NotFoundException('Link not found');

    if (relationshipType === RelationshipType.primary) {
      await this.prisma.caregiverLink.updateMany({
        where: { patientId: link.patientId, isPrimary: true },
        data: { isPrimary: false, relationshipType: RelationshipType.secondary },
      });
    }

    return this.prisma.caregiverLink.update({
      where: { id: linkId },
      data: { relationshipType, isPrimary: relationshipType === RelationshipType.primary },
    });
  }

  async removeLink(linkId: string, caregiverId: string) {
    const link = await this.prisma.caregiverLink.findFirst({ where: { id: linkId, caregiverId } });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.caregiverLink.delete({ where: { id: linkId } });

    if (link.isPrimary) {
      const next = await this.prisma.caregiverLink.findFirst({
        where: { patientId: link.patientId, relationshipType: RelationshipType.secondary },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.caregiverLink.update({
          where: { id: next.id },
          data: { isPrimary: true, relationshipType: RelationshipType.primary },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: caregiverId,
        action: 'link.removed',
        resourceType: 'caregiver_link',
        resourceId: linkId,
      },
    });

    return { success: true };
  }

  async createDirectLink(caregiverId: string, patientId: string, isPrimary: boolean) {
    const existing = await this.prisma.caregiverLink.findFirst({ where: { caregiverId, patientId } });
    if (existing) throw new ConflictException('Already linked');

    if (isPrimary) {
      await this.prisma.caregiverLink.updateMany({
        where: { patientId, isPrimary: true },
        data: { isPrimary: false, relationshipType: RelationshipType.secondary },
      });
    }

    return this.prisma.caregiverLink.create({
      data: {
        caregiverId,
        patientId,
        relationshipType: isPrimary ? RelationshipType.primary : RelationshipType.secondary,
        isPrimary,
      },
    });
  }
}
