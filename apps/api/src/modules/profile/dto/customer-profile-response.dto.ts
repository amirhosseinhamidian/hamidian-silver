import { ApiProperty } from '@nestjs/swagger';

export class CustomerProfileDto {
  id!: string;
  phone!: string;

  @ApiProperty({ type: String, nullable: true })
  firstName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastName!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  phoneVerifiedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export class CustomerAddressDto {
  id!: string;
  title!: string;
  recipientName!: string;
  phone!: string;
  province!: string;
  city!: string;
  addressLine!: string;
  postalCode!: string;
  isDefault!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class DeletedCustomerAddressDto {
  id!: string;
  deletedAt!: Date;
}
