import { IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class ApplySupplierCreditDto {
  @IsUUID('4')
  supplierCreditId!: string;

  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  amountToman!: number;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;
}
