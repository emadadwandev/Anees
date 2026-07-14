import { IsObject, IsString } from 'class-validator';

export class DeviceCommandDto {
  @IsString()
  command!: string;

  @IsObject()
  values: Record<string, unknown> = {};
}
