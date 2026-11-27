import { ApiProperty, OmitType } from '@nestjs/swagger';
import { WalletMovementDto, WalletOperationDto } from './wallet.dto';

export class CustomerWalletMovementDto extends OmitType(WalletMovementDto, [
  'sourceKey',
  'policyVersion',
  'reservationId',
  'originOrderId',
] as const) {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  originOrderId!: string | null;
}

export class CustomerWalletOperationDto extends OmitType(WalletOperationDto, [
  'actorUserId',
  'reason',
  'movements',
] as const) {
  @ApiProperty({ type: () => [CustomerWalletMovementDto] })
  movements!: CustomerWalletMovementDto[];
}

export class CustomerWalletLedgerDto {
  @ApiProperty({ type: () => [CustomerWalletOperationDto] })
  items!: CustomerWalletOperationDto[];
  page!: number;
  hasMore!: boolean;
}

export const walletQuoteReasons = [
  'MINIMUM_CASH',
  'POLICY_DISABLED',
  'NO_AVAILABLE_CREDIT',
  'COUPON_EXCLUDED',
  'NO_ELIGIBLE_ITEMS',
  'POLICY_LIMIT',
] as const;

export class WalletPreviewDto {
  walletAppliedToman!: number;

  @ApiProperty({ enum: [...walletQuoteReasons], nullable: true })
  walletUnavailableReason!: (typeof walletQuoteReasons)[number] | null;
}
