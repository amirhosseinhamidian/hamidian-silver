import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class SetSalePriceDto {
  @IsInt()
  @Min(0)
  salePriceToman!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
