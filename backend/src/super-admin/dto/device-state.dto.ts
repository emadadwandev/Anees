import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DeviceManagementState } from '@prisma/client';

export class DeviceStateDto {
  @IsEnum(DeviceManagementState)
  state!: DeviceManagementState;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class DeviceReasonDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
