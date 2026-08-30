import { IsOptional, IsString, Length } from 'class-validator';

export class MarkSupplierPayablePaidDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
