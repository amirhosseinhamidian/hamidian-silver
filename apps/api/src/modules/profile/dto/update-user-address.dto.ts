import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateUserAddressDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(2, 150)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  province?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(5, 1000)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
