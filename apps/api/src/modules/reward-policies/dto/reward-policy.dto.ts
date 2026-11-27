import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

const ranks = ['ANY', 'FIRST', 'SECOND', 'THIRD_OR_LATER'] as const;
const methods = ['PERCENT', 'FIXED'] as const;
const outcomes = ['UNPAID', 'PAID', 'CANCELLED', 'FULLY_RETURNED'] as const;
export const DEFAULT_REWARD_ACTIVATION_DELAY_DAYS = 7;
export const DEFAULT_REWARD_EXPIRY_DAYS = 270;
const MAX_REWARD_EXPIRY_DAYS = 3_650;
const MAX_REWARD_ACTIVATION_DELAY_DAYS = 3_650;

export function Integer(minimum = 0, maximum = TOMAN_INT_MAX) {
  return applyDecorators(
    ApiProperty({ type: Number, minimum, maximum }),
    Type(() => Object),
    IsInt(),
    Min(minimum),
    Max(maximum),
  );
}

export function Ids(maxItems: number) {
  return applyDecorators(
    ApiProperty({ type: String, isArray: true, maxItems }),
    IsArray(),
    ArrayMaxSize(maxItems),
    ArrayUnique((value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value)),
    IsUUID('all', { each: true }),
  );
}

export function BooleanField() {
  return applyDecorators(
    ApiProperty({ type: Boolean }),
    Type(() => Object),
    IsBoolean(),
  );
}

export class RewardEligibilityDto {
  @BooleanField()
  allowCoupon!: boolean;

  @Ids(50)
  allowedCategoryIds!: string[];

  @Ids(50)
  excludedCategoryIds!: string[];

  @Ids(100)
  excludedProductIds!: string[];
}

export class RewardBandDto {
  @ApiProperty({ maxLength: 40 })
  @Type(() => Object)
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{0,39}$/)
  code!: string;

  @BooleanField()
  enabled!: boolean;

  @Integer(0, 100)
  priority!: number;

  @Integer()
  minimumToman!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: TOMAN_INT_MAX })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  maximumExclusiveToman?: number | null;

  @Integer(1)
  capToman!: number;
}

export class RewardGrantRuleDto extends RewardBandDto {
  @ApiProperty({ enum: [...ranks] })
  @IsIn(ranks)
  purchaseRank!: (typeof ranks)[number];

  @ApiProperty({ enum: [...methods] })
  @IsIn(methods)
  method!: (typeof methods)[number];

  @Integer(1)
  value!: number;
}

export class RewardRedemptionBandDto extends RewardBandDto {
  @Integer(1, 10_000)
  rateBps!: number;
}

export class RewardBudgetDto {
  @Integer()
  rewardPerOrderToman!: number;

  @Integer()
  rewardPerCustomerPeriodToman!: number;

  @Integer()
  rewardPerPeriodToman!: number;

  @Integer()
  incentivesPerOrderToman!: number;

  @Integer()
  incentivesPerCustomerPeriodToman!: number;

  @Integer()
  incentivesPerPeriodToman!: number;
}

export class RewardPolicyDefinitionDto {
  @BooleanField()
  enabled!: boolean;

  @Integer(1, MAX_REWARD_EXPIRY_DAYS)
  expiryDays!: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: MAX_REWARD_ACTIVATION_DELAY_DAYS,
    default: DEFAULT_REWARD_ACTIVATION_DELAY_DAYS,
    description: 'Days after delivery. Zero activates at the next worker run.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(MAX_REWARD_ACTIVATION_DELAY_DAYS)
  activationDelayDays?: number;

  @ApiProperty({ type: () => RewardEligibilityDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardEligibilityDto)
  grantEligibility!: RewardEligibilityDto;

  @ApiProperty({ type: () => RewardEligibilityDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardEligibilityDto)
  redemptionEligibility!: RewardEligibilityDto;

  @ApiProperty({ type: () => RewardBudgetDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardBudgetDto)
  budget!: RewardBudgetDto;

  @ApiProperty({ type: () => RewardGrantRuleDto, isArray: true, maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => RewardGrantRuleDto)
  grantRules!: RewardGrantRuleDto[];

  @ApiProperty({ type: () => RewardRedemptionBandDto, isArray: true, maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => RewardRedemptionBandDto)
  redemptionBands!: RewardRedemptionBandDto[];
}

export class RewardActivationTimingDto {
  @ApiProperty({ type: Number, nullable: true })
  policyVersion!: number | null;

  @ApiProperty({ type: Number, minimum: 0, maximum: MAX_REWARD_ACTIVATION_DELAY_DAYS })
  activationDelayDays!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: MAX_REWARD_EXPIRY_DAYS })
  expiryDays!: number;
}

export class UpdateRewardActivationTimingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedPolicyVersion!: number | null;

  @Integer(0, MAX_REWARD_ACTIVATION_DELAY_DAYS)
  activationDelayDays!: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: MAX_REWARD_EXPIRY_DAYS })
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(MAX_REWARD_EXPIRY_DAYS)
  expiryDays?: number;
}

export class CreateRewardPolicyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
  requestedEffectiveAt?: string | null;

  @ApiProperty({ type: () => RewardPolicyDefinitionDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardPolicyDefinitionDto)
  definition!: RewardPolicyDefinitionDto;
}

export class RewardPolicyPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class RewardPolicyVersionParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  version!: number;
}

export class RewardPolicyVersionDto {
  version!: number;
  enabled!: boolean;
  createdById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  requestedEffectiveAt!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  publishedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  publishedById!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  effectiveAt!: string | null;
}

export class RewardPolicyDetailDto extends RewardPolicyVersionDto {
  @ApiProperty({ type: () => RewardPolicyDefinitionDto })
  definition!: RewardPolicyDefinitionDto;
}

export class RewardPolicyListDto {
  @ApiProperty({ type: () => RewardPolicyVersionDto, isArray: true })
  items!: RewardPolicyVersionDto[];
  page!: number;
  hasMore!: boolean;
}

export class ActiveRewardPolicyDto {
  @ApiProperty({ type: () => RewardPolicyDetailDto, nullable: true })
  policy!: RewardPolicyDetailDto | null;
}

export class RewardSampleLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @Ids(50)
  categoryIds!: string[];

  @Integer()
  merchandiseToman!: number;

  @Integer()
  directDiscountToman!: number;

  @Integer()
  settledCreditToman!: number;

  @Integer()
  refundedCashToman!: number;
}

export class RewardPeriodUsageDto {
  @Integer(0, Number.MAX_SAFE_INTEGER)
  customerRewardsToman!: number;

  @Integer(0, Number.MAX_SAFE_INTEGER)
  periodRewardsToman!: number;

  @Integer(0, Number.MAX_SAFE_INTEGER)
  customerIncentivesToman!: number;

  @Integer(0, Number.MAX_SAFE_INTEGER)
  periodIncentivesToman!: number;
}

export class SimulateRewardPolicyDto {
  @ApiProperty({ type: () => RewardSampleLineDto, isArray: true, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => RewardSampleLineDto)
  lines!: RewardSampleLineDto[];

  @ApiProperty({ enum: [...outcomes] })
  @IsIn(outcomes)
  outcome!: (typeof outcomes)[number];

  @Integer()
  previousCompletedPurchases!: number;

  @BooleanField()
  couponApplied!: boolean;

  @Integer()
  shippingDiscountToman!: number;

  @Integer()
  otherOrderIncentivesToman!: number;

  @Integer()
  availableCreditToman!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: TOMAN_INT_MAX })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  campaignRedemptionCapToman?: number | null;

  @ApiProperty({ type: () => RewardPeriodUsageDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardPeriodUsageDto)
  usage!: RewardPeriodUsageDto;
}

export class RewardPolicySimulationRequestDto extends SimulateRewardPolicyDto {
  @Integer(1)
  version!: number;
}

export class RewardSimulationDto {
  version!: number;
  enabled!: boolean;

  @ApiProperty({ enum: ['FIRST', 'SECOND', 'THIRD_OR_LATER'] })
  purchaseRank!: Exclude<(typeof ranks)[number], 'ANY'>;

  @ApiProperty({ type: String, nullable: true })
  grantRuleCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  redemptionBandCode!: string | null;

  rewardBaseToman!: number;
  redemptionBaseToman!: number;
  calculatedRewardToman!: number;
  estimatedRewardToman!: number;
  maxRedemptionToman!: number;
  existingOrderIncentivesToman!: number;
  remainingRewardBudgetToman!: number;
  existingIncentivesExceedLimit!: boolean;
  expiryDays!: number;
}
