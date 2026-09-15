import { ApiProperty } from '@nestjs/swagger';
import { AdminSiteMediaDto } from '../../site-settings/dto/admin-site-media.dto';

export const SHIPPING_PRICING_MODES = ['FREE', 'FIXED'] as const;
export type ShippingPricingMode = (typeof SHIPPING_PRICING_MODES)[number];

export class ShippingPricingSettingsDto {
  @ApiProperty({ enum: SHIPPING_PRICING_MODES })
  mode!: ShippingPricingMode;

  @ApiProperty({ minimum: 0 })
  baseCostToman!: number;

  @ApiProperty({ nullable: true, minimum: 1 })
  thresholdToman!: number | null;

  @ApiProperty({ nullable: true, minimum: 0 })
  discountedCostToman!: number | null;
}

export class AdminShippingPricingSettingsDto extends ShippingPricingSettingsDto {
  @ApiProperty({ nullable: true })
  carrierName!: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  carrierTrackingUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  carrierLogoMediaId!: string | null;

  @ApiProperty({ type: () => AdminSiteMediaDto, nullable: true })
  carrierLogo!: AdminSiteMediaDto | null;

  @ApiProperty({ enum: ['DATABASE', 'ENVIRONMENT'] })
  source!: 'DATABASE' | 'ENVIRONMENT';

  @ApiProperty({ nullable: true, format: 'uuid' })
  updatedByUserId!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  updatedAt!: string | null;
}
