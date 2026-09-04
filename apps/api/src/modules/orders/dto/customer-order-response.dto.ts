import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PlatingType } from '../../../generated/prisma/enums';

export class CustomerOrderItemDto {
  id!: string;
  variantId!: string;
  quantity!: number;
  productNameSnapshot!: string;

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
  @ApiProperty({ type: () => CustomerOrderShippingAddressDto })
  shippingAddress!: CustomerOrderShippingAddressDto;

  @ApiProperty({ type: () => CustomerOrderStatusHistoryDto, isArray: true })
  statusHistory!: CustomerOrderStatusHistoryDto[];
}
