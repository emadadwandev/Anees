import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DeviceManagementState, DeviceStatus, DeviceTransport } from '@prisma/client';

export class DeviceFilterDto {
  @IsOptional()
  @IsEnum(DeviceTransport)
  transport?: DeviceTransport;

  @IsOptional()
  @IsEnum(DeviceManagementState)
  managementState?: DeviceManagementState;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeprovisioned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
