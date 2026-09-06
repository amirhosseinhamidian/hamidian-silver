import { ApiProperty } from '@nestjs/swagger';
import { OrderReturnDisposition, OrderReturnStatus } from '../../../generated/prisma/enums';

export class CustomerOrderReturnItemDto {
  id!: string;
  orderItemId!: string;
  quantity!: number;

  @ApiProperty({ enum: OrderReturnDisposition, nullable: true })
  disposition!: OrderReturnDisposition | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export class CustomerOrderReturnDto {
  id!: string;
  orderId!: string;

  @ApiProperty({ enum: OrderReturnStatus })
  status!: OrderReturnStatus;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  receivedAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  cancelledAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;

  @ApiProperty({ type: () => CustomerOrderReturnItemDto, isArray: true })
  items!: CustomerOrderReturnItemDto[];
}

export class OrderReturnAuthorizationDto {
  orderId!: string;
  authorizedAt!: Date;
  reason!: string;
}
