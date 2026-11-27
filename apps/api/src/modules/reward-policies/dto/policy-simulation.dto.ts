import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  ReferralRewardPreviewDto,
  ReferralRewardUseDto,
} from '../../referrals/dto/referral-reward-policy.dto';
import {
  ReferralRiskPreviewDto,
  ReferralRiskMetricDto,
} from '../../referrals/dto/referral-risk.dto';
import {
  BooleanField,
  Integer,
  RewardPeriodUsageDto,
  RewardSimulationDto,
} from './reward-policy.dto';

const decisions = ['RECOMMEND', 'HOLD', 'REJECT'] as const;
const outcomes = ['PAID', 'UNPAID', 'CANCELLED', 'FULLY_RETURNED'] as const;

export class PolicySimulationDecisionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ enum: [...decisions] })
  @IsIn(decisions)
  decision!: (typeof decisions)[number];
}

class PolicySimulationInputDto {
  @Integer(1)
  version!: number;

  @ApiPropertyOptional({ type: () => PolicySimulationDecisionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PolicySimulationDecisionDto)
  review?: PolicySimulationDecisionDto;
}

export class PolicyBasketLineDto {
  @ApiProperty({ maxLength: 220 })
  @IsString()
  @Length(1, 220)
  productSlug!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  variantSku?: string;

  @Integer(1, 100)
  quantity!: number;
}

export class PolicyReferralScenarioDto {
  @Integer(1)
  version!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 2147483647 })
  @IsOptional()
  @Integer(1)
  riskVersion?: number;

  @BooleanField()
  referrerHasPurchased!: boolean;

  @BooleanField()
  delivered!: boolean;

  @BooleanField()
  returnPending!: boolean;

  @Integer(0, Number.MAX_SAFE_INTEGER)
  referrerIncentivesToman!: number;

  @Integer(0, 3650)
  claimAgeDays!: number;

  @Integer(0, Number.MAX_SAFE_INTEGER)
  programCommittedToman!: number;

  @ApiProperty({ type: () => [ReferralRewardUseDto], maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((row: ReferralRewardUseDto | null) => row?.ruleCode)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRewardUseDto)
  usage!: ReferralRewardUseDto[];

  @ApiProperty({ type: () => [ReferralRiskMetricDto], maxItems: 9 })
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique((row: ReferralRiskMetricDto | null) => row?.code)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRiskMetricDto)
  metrics!: ReferralRiskMetricDto[];
}

export class PolicyBasketScenarioDto extends PolicySimulationInputDto {
  @ApiProperty({ type: () => [PolicyBasketLineDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((line: PolicyBasketLineDto | null) =>
    JSON.stringify([line?.productSlug, line?.variantSku]),
  )
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PolicyBasketLineDto)
  items!: PolicyBasketLineDto[];

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)
  occurredAt!: string;

  @ApiProperty({ enum: [...outcomes] })
  @IsIn(outcomes)
  outcome!: (typeof outcomes)[number];

  @Integer(0, 9999)
  previousCompletedPurchases!: number;

  @Integer()
  shippingToman!: number;

  @Integer()
  availableCreditToman!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @BooleanField()
  couponApplied!: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanField()
  hadPriorPaidOrder?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanField()
  promotionPreviouslyRedeemed?: boolean;

  @ApiProperty({ type: () => RewardPeriodUsageDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardPeriodUsageDto)
  usage!: RewardPeriodUsageDto;

  @ApiPropertyOptional({ type: () => PolicyReferralScenarioDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PolicyReferralScenarioDto)
  referral?: PolicyReferralScenarioDto;
}

export class PolicyHistoryScenarioDto extends PolicySimulationInputDto {
  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @BooleanField()
  pendingOnly?: boolean;
}

export class PolicyBasketResultLineDto extends PolicyBasketLineDto {
  @ApiProperty({ type: Number, nullable: true })
  defaultPriceToman!: number | null;
  unitPriceToman!: number;
  merchandiseDiscountToman!: number;
  referralDiscountToman!: number;
  walletToman!: number;
}

export class PolicyBasketResultDto {
  @ApiProperty({ type: () => [PolicyBasketResultLineDto] })
  items!: PolicyBasketResultLineDto[];
  merchandiseToman!: number;
  merchandiseDiscountToman!: number;
  shippingToman!: number;
  shippingDiscountToman!: number;
  referralDiscountToman!: number;
  walletToman!: number;
  payableToman!: number;
  activationDelayDays!: number;
  @ApiProperty({ type: Number, nullable: true })
  campaignRevision!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  promotionVersion!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  remainingCampaignBudgetToman!: number | null;
  @ApiProperty({ type: () => RewardSimulationDto })
  reward!: RewardSimulationDto;
  @ApiProperty({ type: () => ReferralRewardPreviewDto, nullable: true })
  referral!: ReferralRewardPreviewDto | null;
  @ApiProperty({ type: () => ReferralRiskPreviewDto, nullable: true })
  risk!: ReferralRiskPreviewDto | null;
  @ApiProperty({ type: Number, nullable: true })
  resolvedRiskVersion!: number | null;
  @ApiProperty({ type: [String] })
  warnings!: string[];
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reviewId!: string | null;
}

export class PolicyHistoryResultDto {
  version!: number;
  pendingOnly!: boolean;
  scannedOrders!: number;
  evaluatedOrders!: number;
  withoutEvidence!: number;
  truncated!: boolean;
  recordedRewardToman!: number;
  estimatedRewardToman!: number;
  limitedOrders!: number;
  fingerprint!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reviewId!: string | null;
}

export class PolicyReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  actorUserId!: string;
  @ApiProperty({ enum: ['BASKET', 'HISTORY'] })
  mode!: 'BASKET' | 'HISTORY';
  @ApiProperty({ enum: [...decisions] })
  decision!: (typeof decisions)[number];
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  input!: Record<string, unknown>;
  @ApiProperty({ type: 'object', additionalProperties: true })
  result!: Record<string, unknown>;
}

export class PolicyReviewListDto {
  @ApiProperty({ type: () => [PolicyReviewDto] })
  items!: PolicyReviewDto[];
  page!: number;
  hasMore!: boolean;
}
