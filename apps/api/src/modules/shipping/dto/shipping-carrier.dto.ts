import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { AdminSiteMediaDto } from '../../site-settings/dto/admin-site-media.dto';

export class CreateShippingCarrierDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ minLength: 2, maxLength: 240 })
  @IsString()
  @Length(2, 240)
  subtitle!: string;

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

  @ApiPropertyOptional({ enum: ['FREE', 'FIXED', 'COLLECT'], default: 'FREE' })
  @IsOptional()
  @IsIn(['FREE', 'FIXED', 'COLLECT'])
  pricingMode?: 'FREE' | 'FIXED' | 'COLLECT';

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  baseCostToman?: number;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  thresholdToman?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountedCostToman?: number | null;

  @ApiPropertyOptional({ enum: ['NATIONWIDE', 'TEHRAN_ONLY'], default: 'NATIONWIDE' })
  @IsOptional()
  @IsIn(['NATIONWIDE', 'TEHRAN_ONLY'])
  serviceArea?: 'NATIONWIDE' | 'TEHRAN_ONLY';

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

  @ApiProperty({ nullable: true, minLength: 2, maxLength: 240 })
  subtitle!: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  trackingUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  logoMediaId!: string | null;

  @ApiProperty({ type: () => AdminSiteMediaDto, nullable: true })
  logo!: AdminSiteMediaDto | null;

  @ApiProperty({ enum: ['FREE', 'FIXED', 'COLLECT'] })
  pricingMode!: 'FREE' | 'FIXED' | 'COLLECT';

  baseCostToman!: number;

  @ApiProperty({ nullable: true })
  thresholdToman!: number | null;

  @ApiProperty({ nullable: true })
  discountedCostToman!: number | null;

  @ApiProperty({ enum: ['NATIONWIDE', 'TEHRAN_ONLY'] })
  serviceArea!: 'NATIONWIDE' | 'TEHRAN_ONLY';

  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PublicShippingOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  name!: string;

  @ApiProperty({ nullable: true, minLength: 2, maxLength: 240 })
  subtitle!: string | null;

  @ApiProperty({ type: () => AdminSiteMediaDto, nullable: true })
  logo!: AdminSiteMediaDto | null;

  @ApiProperty({ enum: ['FREE', 'FIXED', 'COLLECT'] })
  pricingMode!: 'FREE' | 'FIXED' | 'COLLECT';

  baseCostToman!: number;

  @ApiProperty({ nullable: true })
  thresholdToman!: number | null;

  @ApiProperty({ nullable: true })
  discountedCostToman!: number | null;

  @ApiProperty({ enum: ['NATIONWIDE', 'TEHRAN_ONLY'] })
  serviceArea!: 'NATIONWIDE' | 'TEHRAN_ONLY';
}
