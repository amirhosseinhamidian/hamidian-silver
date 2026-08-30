import { IsOptional, IsString, Length } from 'class-validator';

export class CancelSupplierSettlementDto {
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;
}
