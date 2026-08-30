import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ShipmentStatus } from '../../../generated/prisma/enums';

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  trackingCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  providerShipmentId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
