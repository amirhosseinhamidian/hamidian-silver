import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, PlatingType } from '../../../generated/prisma/enums';

export enum CustomerPaymentMethod {
  CARD_TO_CARD = 'CARD_TO_CARD',
  PAYMENT_GATEWAY = 'PAYMENT_GATEWAY',
}

export class CustomerOrderPaymentDto {
  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ enum: CustomerPaymentMethod, nullable: true })
  method!: CustomerPaymentMethod | null;

  receiptAvailable!: boolean;

  @ApiProperty({ type: String, nullable: true })
  receiptOriginalName!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  receiptUploadedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason!: string | null;
}

export class CustomerOrderMediaDto {
  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  url!: string | null;

  mimeType!: string;

  @ApiProperty({ type: String, nullable: true })
  altText!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;
}

export class CustomerOrderItemDto {
  id!: string;
  variantId!: string;
  quantity!: number;
  productNameSnapshot!: string;
  productSlug!: string;

  @ApiProperty({ type: () => CustomerOrderMediaDto, nullable: true })
  primaryMedia!: CustomerOrderMediaDto | null;

  @ApiProperty({ type: String, nullable: true })
  variantNameSnapshot!: string | null;

  skuSnapshot!: string;

  @ApiProperty({ type: String, nullable: true })
  sizeLabelSnapshot!: string | null;

  unitSalePriceToman!: number;

  @ApiProperty({ enum: PlatingType, nullable: true })
  platingType!: PlatingType | null;

  @ApiProperty({ type: String, nullable: true })
  platingWeightGrams!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  platingRateToman!: number | null;

  unitPlatingPriceToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  platingLeadTimeDays!: number | null;

  @ApiProperty({ type: String, nullable: true })
  unitWeightGrams!: string | null;

  lineTotalToman!: number;
  returnableQuantity!: number;
  createdAt!: Date;
}

export class CustomerOrderSummaryDto {
  id!: string;
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  merchandiseTotalToman!: number;
  platingTotalToman!: number;
  discountTotalToman!: number;
  shippingTotalToman!: number;
  taxTotalToman!: number;
  grandTotalToman!: number;
  returnAuthorized!: boolean;

  @ApiProperty({ type: () => CustomerOrderPaymentDto, nullable: true })
  payment!: CustomerOrderPaymentDto | null;

  @ApiProperty({ type: String, nullable: true })
  trackingCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  shippingMethodName!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  shippingTrackingUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  shippingCarrierLogoUrl!: string | null;

  shippingPayOnDelivery!: boolean;
  reservationExpiresAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  deliveredAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;

  @ApiProperty({ type: () => CustomerOrderItemDto, isArray: true })
  items!: CustomerOrderItemDto[];
}

export class CustomerOrderCountDto {
  count!: number;
}

export class CustomerOrderShippingAddressDto {
  recipientName!: string;
  phone!: string;
  province!: string;
  city!: string;
  addressLine!: string;
  postalCode!: string;
}

export class CustomerOrderStatusHistoryDto {
  @ApiProperty({ enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus!: OrderStatus;

  createdAt!: Date;
}

export class CustomerOrderDetailDto extends CustomerOrderSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  customerNote!: string | null;

  @ApiProperty({ type: () => CustomerOrderShippingAddressDto })
  shippingAddress!: CustomerOrderShippingAddressDto;

  @ApiProperty({ type: () => CustomerOrderStatusHistoryDto, isArray: true })
  statusHistory!: CustomerOrderStatusHistoryDto[];

  @ApiProperty({ type: String, nullable: true })
  cancellationReason!: string | null;
}
