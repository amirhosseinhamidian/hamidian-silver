import { IsDateString, IsOptional } from 'class-validator';

export class FinancePeriodQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
