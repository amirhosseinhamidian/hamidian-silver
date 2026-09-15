import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, IsUUID, Length, MaxLength } from 'class-validator';
import { AdminSiteMediaDto } from '../../site-settings/dto/admin-site-media.dto';

export class CreateShippingCarrierDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uri', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  trackingUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  logoMediaId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingCarrierDto extends PartialType(CreateShippingCarrierDto) {}

export class ShippingCarrierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ nullable: true, format: 'uri' })
  trackingUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  logoMediaId!: string | null;

  @ApiProperty({ type: () => AdminSiteMediaDto, nullable: true })
  logo!: AdminSiteMediaDto | null;

  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
