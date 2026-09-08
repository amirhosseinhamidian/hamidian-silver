import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateManualShipmentDto {
  @IsString()
  @Length(2, 200)
  serviceName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  estimatedDeliveryDays?: number;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
