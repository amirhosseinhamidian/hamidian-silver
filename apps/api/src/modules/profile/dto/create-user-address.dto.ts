import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateUserAddressDto {
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsString()
  @Length(2, 150)
  recipientName!: string;

  @IsString()
  @Length(10, 20)
  phone!: string;

  @IsString()
  @Length(2, 100)
  province!: string;

  @IsString()
  @Length(2, 100)
  city!: string;

  @IsString()
  @Length(5, 1000)
  addressLine!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  postalCode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
