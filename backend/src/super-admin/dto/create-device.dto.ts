import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DeviceTransport, DeviceType, Prisma } from '@prisma/client';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @IsString()
  @IsNotEmpty()
  firmwareVersion!: string;

  @IsString()
  @IsNotEmpty()
  roomLabel!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @IsEnum(DeviceTransport)
  transport!: DeviceTransport;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsObject()
  capabilities?: Prisma.InputJsonValue;
}
