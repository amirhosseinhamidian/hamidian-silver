import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';
import { SHIPPING_PRICING_MODES, type ShippingPricingMode } from './shipping-pricing-settings.dto';

export class UpdateShippingPricingSettingsDto {
  @ApiProperty({ enum: SHIPPING_PRICING_MODES })
  @IsIn(SHIPPING_PRICING_MODES)
  mode!: ShippingPricingMode;

  @ApiProperty({ minimum: 0, maximum: TOMAN_INT_MAX })
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  baseCostToman!: number;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: TOMAN_INT_MAX })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  thresholdToman?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: TOMAN_INT_MAX })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  discountedCostToman?: number | null;
}
