import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class SetSalePriceDto {
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  salePriceToman!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
