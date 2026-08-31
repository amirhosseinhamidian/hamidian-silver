import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class CompletePlatingFulfillmentDto {
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  actualCostToman!: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
