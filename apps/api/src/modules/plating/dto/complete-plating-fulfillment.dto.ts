import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CompletePlatingFulfillmentDto {
  @IsInt()
  @Min(0)
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
