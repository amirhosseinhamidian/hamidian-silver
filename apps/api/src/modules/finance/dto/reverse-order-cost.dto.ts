import { IsOptional, IsString, Length } from 'class-validator';

export class ReverseOrderCostDto {
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;
}
