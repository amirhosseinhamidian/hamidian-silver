import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum RevenueEventKind {
  ORDER_SUBMITTED = 'order_submitted',
  RECEIPT_SUBMITTED = 'payment_receipt_submitted',
  RECEIPT_REJECTED = 'payment_receipt_rejected',
  RECONCILIATION_REQUIRED = 'payment_reconciliation_required',
  PURCHASE_CONFIRMED = 'purchase_confirmed',
  ORDER_DELIVERED = 'order_delivered',
  CANCELLATION = 'cancellation',
  ORDER_EXPIRED = 'order_expired',
  RETURN_RECEIVED = 'return_received',
  REFUND_ADJUSTMENT = 'refund_adjustment',
  PAYMENT_CHANNEL_FEE = 'payment_channel_fee',
  SHIPPING_PROVIDER_COST = 'shipping_provider_cost',
}

const dateShape = /^[1-9]\d{3}-\d{2}-\d{2}$/;
const attributionToken = /^[a-z0-9][a-z0-9._-]*$/;

export class GrowthRevenueQueryDto {
  @ApiProperty({ format: 'date', description: 'First included calendar day in Asia/Tehran.' })
  @IsDateString({ strict: true })
  @Matches(dateShape)
  from!: string;

  @ApiProperty({ format: 'date', description: 'Last included calendar day in Asia/Tehran.' })
  @IsDateString({ strict: true })
  @Matches(dateShape)
  to!: string;

  @IsOptional()
  @IsString()
  @Length(1, 96)
  @Matches(attributionToken)
  source?: string;

  @IsOptional()
  @IsString()
  @Length(1, 96)
  @Matches(attributionToken)
  medium?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(attributionToken)
  campaignId?: string;
}

export class GrowthRevenueEventsQueryDto extends GrowthRevenueQueryDto {
  @ApiPropertyOptional({ enum: RevenueEventKind })
  @IsOptional()
  @IsEnum(RevenueEventKind)
  kind?: RevenueEventKind;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GrowthRevenuePeriodDto {
  @ApiProperty({ format: 'date' })
  from!: string;
  @ApiProperty({ format: 'date' })
  to!: string;
  @ApiProperty({ enum: ['Asia/Tehran'] })
  timezone!: 'Asia/Tehran';
}

export class GrowthRevenueSummaryDto {
  @ApiProperty({ type: () => GrowthRevenuePeriodDto })
  period!: GrowthRevenuePeriodDto;
  @ApiProperty({ enum: ['TOMAN'] })
  currency!: 'TOMAN';
  submittedOrderCount!: number;
  paidOrderCount!: number;
  attributedPaidOrderCount!: number;
  paidOrderWithoutFinanceSnapshotCount!: number;
  deliveredPaidOrderCount!: number;
  cancelledOrderCount!: number;
  expiredOrderCount!: number;
  receiptSubmittedCount!: number;
  awaitingReceiptReviewOrderCount!: number;
  receiptRejectedCount!: number;
  paymentReconciliationCount!: number;
  receivedReturnCount!: number;
  confirmedRefundCount!: number;
  merchandiseToman!: number;
  platingToman!: number;
  orderDiscountToman!: number;
  shippingChargedToman!: number;
  taxToman!: number;
  collectedToman!: number;
  refundedToman!: number;
  netCollectedToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  paymentChannelFeeToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  shippingProviderCostToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  campaignDiscountToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  walletAppliedToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  marketingChannelCostToman!: number | null;
}

export class GrowthRevenueEventDto {
  eventId!: string;
  @ApiProperty({ format: 'uuid' })
  orderId!: string;
  @ApiProperty({ enum: RevenueEventKind })
  kind!: RevenueEventKind;
  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;
  @ApiProperty({ type: Number, nullable: true })
  amountToman!: number | null;
  @ApiProperty({ type: String, nullable: true })
  provider!: string | null;
  @ApiProperty({ type: String, nullable: true })
  source!: string | null;
  @ApiProperty({ type: String, nullable: true })
  medium!: string | null;
  @ApiProperty({ type: String, nullable: true })
  campaign!: string | null;
  @ApiProperty({ type: String, nullable: true })
  campaignId!: string | null;
}

export class GrowthRevenueEventsDto {
  @ApiProperty({ type: () => GrowthRevenuePeriodDto })
  period!: GrowthRevenuePeriodDto;
  @ApiProperty({ type: () => GrowthRevenueEventDto, isArray: true })
  items!: GrowthRevenueEventDto[];
  page!: number;
  limit!: number;
  total!: number;
}
