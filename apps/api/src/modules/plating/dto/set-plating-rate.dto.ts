import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class SetPlatingRateDto {
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  pricePerGramToman!: number;

  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
