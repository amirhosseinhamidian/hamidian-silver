import { IsInt, IsString, IsUUID, Length, Min } from 'class-validator';

export class ApplySupplierCreditDto {
  @IsUUID('4')
  supplierCreditId!: string;

  @IsInt()
  @Min(1)
  amountToman!: number;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;
}
