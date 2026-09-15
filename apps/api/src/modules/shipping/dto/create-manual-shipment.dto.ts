import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';

export class CreateManualShipmentDto {
  @IsOptional()
  @IsUUID('4')
  carrierId?: string;

  @ValidateIf((dto: CreateManualShipmentDto) => !dto.carrierId)
  @IsString()
  @Length(2, 200)
  serviceName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  estimatedDeliveryDays?: number;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
