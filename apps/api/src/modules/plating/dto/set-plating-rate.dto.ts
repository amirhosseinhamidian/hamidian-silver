import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SetPlatingRateDto {
  @IsInt()
  @Min(0)
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
