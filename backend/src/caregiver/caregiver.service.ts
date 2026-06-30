import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, RelationshipType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CaregiverService {
  constructor(private readonly prisma: PrismaService) {}

  async getLinkedPatient(caregiverId: string) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, isPrimary: true },
      include: {
        patient: { include: { devices: true } },
      },
    });
    if (!link) return null;
    const p = link.patient;
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      accountCode: p.accountCode,
      room: p.devices[0]?.roomLabel ?? '',
      deviceSerial: p.devices[0]?.serial ?? null,
      deviceStatus: p.devices[0]?.status ?? null,
      phone: p.phone ?? null,
      language: p.language,
    };
  }

  async createPatient(
    caregiverId: string,
    dto: {
      firstName: string;
      lastName: string;
      phone?: string;
      language?: string;
    },
  ) {
    const code = `${dto.firstName.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const email = `${code.toLowerCase()}@anees.internal`;

    // pinHash is intentionally null — elderly person sets their own PIN on first login
    const patient = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(Math.random().toString(36), 10),
        accountCode: code,
        role: Role.care_receiver,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        language: dto.language ?? 'ar',
      },
    });

    await this.prisma.caregiverLink.create({
      data: {
        caregiverId,
        patientId: patient.id,
        relationshipType: RelationshipType.primary,
        isPrimary: true,
      },
    });

    return {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      accountCode: patient.accountCode,
    };
  }

  async updatePatient(
    caregiverId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; language?: string },
  ) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, isPrimary: true },
    });
    if (!link) throw new ForbiddenException('No linked patient');
    return this.prisma.user.update({
      where: { id: link.patientId },
      data: dto,
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, language: true, accountCode: true,
      },
    });
  }

  async updatePatientPin(caregiverId: string, pin: string) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, isPrimary: true },
    });
    if (!link) throw new ForbiddenException('No linked patient');
    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.user.update({
      where: { id: link.patientId },
      data: { pinHash },
    });
  }

  async registerDevice(
    caregiverId: string,
    dto: {
      serial: string;
      firmwareVersion: string;
      roomLabel: string;
      deviceType: string;
      patientId: string;
    },
  ) {
    const link = await this.prisma.caregiverLink.findFirst({
      where: { caregiverId, patientId: dto.patientId },
    });
    if (!link) throw new ForbiddenException('Not linked to this patient');

    return this.prisma.device.upsert({
      where: { serial: dto.serial },
      update: {
        userId: dto.patientId,
        roomLabel: dto.roomLabel,
        firmwareVersion: dto.firmwareVersion,
      },
      create: {
        serial: dto.serial,
        firmwareVersion: dto.firmwareVersion,
        roomLabel: dto.roomLabel,
        deviceType: dto.deviceType as any,
        userId: dto.patientId,
        status: 'offline' as any,
      },
    });
  }
}
