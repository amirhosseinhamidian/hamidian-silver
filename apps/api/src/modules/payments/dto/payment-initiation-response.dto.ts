import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentAttemptStatus } from '../../../generated/prisma/enums';

export class PaymentInitiationResponseDto {
  @ApiProperty({ format: 'uuid' })
  attemptId!: string;

  @ApiProperty({ enum: PaymentAttemptStatus })
  status!: PaymentAttemptStatus;

  @ApiPropertyOptional()
  authority?: string;

  @ApiPropertyOptional({ format: 'uri' })
  paymentUrl?: string;

  @ApiPropertyOptional()
  alreadyPaid?: boolean;

  @ApiPropertyOptional()
  reconciliationRequired?: boolean;

  @ApiPropertyOptional()
  reconciled?: boolean;
}
