import { IsBoolean, IsString, Length } from 'class-validator';

export class ResetShipmentProviderCreationDto {
  @IsBoolean()
  confirmNoProviderShipment!: boolean;

  @IsString()
  @Length(3, 500)
  reason!: string;
}
