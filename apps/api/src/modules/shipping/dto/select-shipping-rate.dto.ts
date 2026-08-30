import { IsString, Length } from 'class-validator';

export class SelectShippingRateDto {
  @IsString()
  @Length(1, 120)
  serviceCode!: string;
}
