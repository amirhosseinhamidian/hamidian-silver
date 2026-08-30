import { IsEnum, IsOptional } from 'class-validator';
import { PaymentReconciliationStatus } from '../../../generated/prisma/enums';

export class ListPaymentReconciliationsQueryDto {
  @IsOptional()
  @IsEnum(PaymentReconciliationStatus)
  status?: PaymentReconciliationStatus;
}
