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
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BooleanField,
  Ids,
  Integer,
  RewardGrantRuleDto,
} from '../../reward-policies/dto/reward-policy.dto';

export const referralRecipients = ['REFERRER', 'REFERRED'] as const;
export type ReferralRecipient = (typeof referralRecipients)[number];
const timestampPattern = /T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export class ReferralRewardRuleDto extends RewardGrantRuleDto {
  @ApiProperty({ enum: [...referralRecipients] })
  @IsIn(referralRecipients)
  recipient!: ReferralRecipient;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(timestampPattern)
  startsAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(timestampPattern)
  endsAt?: string | null;

  @Integer(1, 3650) expiryDays!: number;
  @Integer(1, 10000) maxUsesPerRecipient!: number;
  @Integer() periodBudgetToman!: number;
  @Ids(50) campaignIds!: string[];
  @Ids(50) allowedCategoryIds!: string[];
  @BooleanField() allowCampaign!: boolean;
  @BooleanField() allowCoupon!: boolean;
  @BooleanField() allowPurchaseReward!: boolean;
}

export class ReferralRewardDefinitionDto {
  @BooleanField() enabled!: boolean;
  @Integer() periodBudgetToman!: number;

  @ApiProperty({ type: () => [ReferralRewardRuleDto], maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRewardRuleDto)
  rules!: ReferralRewardRuleDto[];
}

export class CreateReferralRewardDraftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(timestampPattern)
  requestedEffectiveAt?: string | null;

  @ApiProperty({ type: () => ReferralRewardDefinitionDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferralRewardDefinitionDto)
  definition!: ReferralRewardDefinitionDto;
}

class ReferralRewardLineDto {
  @Integer() eligibleToman!: number;
  @Ids(50) categoryIds!: string[];
}

class ReferralRewardUseDto {
  @Matches(/^[a-z0-9][a-z0-9_-]{0,39}$/)
  ruleCode!: string;

  @Integer(0, 10000) recipientUses!: number;
  @Integer(0, Number.MAX_SAFE_INTEGER) committedToman!: number;
}

export class ReferralRewardSampleDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(timestampPattern)
  occurredAt!: string;

  @Integer(1, 10000) purchaseRank!: number;
  @BooleanField() confirmed!: boolean;
  @BooleanField() couponApplied!: boolean;
  @BooleanField() purchaseRewardApplied!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all')
  campaignId!: string | null;

  @ApiProperty({ type: () => [ReferralRewardLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRewardLineDto)
  lines!: ReferralRewardLineDto[];

  @ApiProperty({ type: () => [ReferralRewardUseDto], maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((use: ReferralRewardUseDto | null) => use?.ruleCode)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRewardUseDto)
  usage!: ReferralRewardUseDto[];

  @Integer(0, Number.MAX_SAFE_INTEGER) programCommittedToman!: number;
  @Integer() remainingIncentiveToman!: number;
}

export class SimulateReferralRewardPolicyDto {
  @ApiProperty({ type: () => ReferralRewardDefinitionDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferralRewardDefinitionDto)
  definition!: ReferralRewardDefinitionDto;

  @ApiProperty({ type: () => ReferralRewardSampleDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferralRewardSampleDto)
  sample!: ReferralRewardSampleDto;
}

export class ReferralPolicyVersionParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  version!: number;
}

export class ReferralScopeQueryDto {
  @ApiProperty({ enum: ['category', 'campaign'] })
  @IsIn(['category', 'campaign'])
  kind!: 'category' | 'campaign';

  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  @Type(() => Object)
  q!: string;
}

export class ReferralScopeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  name!: string;
}

export class ReferralPolicyVersionDto {
  version!: number;
  enabled!: boolean;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) requestedEffectiveAt!:
    string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) publishedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) effectiveAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) publishedById!: string | null;
}

export class ReferralPolicyDetailDto extends ReferralPolicyVersionDto {
  @ApiProperty({ type: () => ReferralRewardDefinitionDto })
  definition!: ReferralRewardDefinitionDto;
}

export class ReferralPolicyListDto {
  @ApiProperty({ type: () => [ReferralPolicyVersionDto] }) items!: ReferralPolicyVersionDto[];
  page!: number;
  hasMore!: boolean;
  @ApiProperty({ type: () => ReferralPolicyDetailDto, nullable: true })
  active!: ReferralPolicyDetailDto | null;
}

const previewReasons = [
  'AWARDED',
  'PROGRAM_DISABLED',
  'UNCONFIRMED',
  'NO_MATCH',
  'USE_LIMIT',
  'BUDGET_LIMIT',
  'VALUE_LIMIT',
] as const;

export class ReferralRewardPreviewLineDto {
  @ApiProperty({ enum: [...referralRecipients] }) recipient!: ReferralRecipient;
  @ApiProperty({ type: String, nullable: true }) ruleCode!: string | null;
  @ApiProperty({ enum: [...previewReasons] }) reason!: (typeof previewReasons)[number];
  eligibleToman!: number;
  amountToman!: number;
  @ApiProperty({ type: Number, nullable: true }) expiryDays!: number | null;
}

export class ReferralRewardPreviewDto {
  @ApiProperty({ type: () => [ReferralRewardPreviewLineDto] })
  recipients!: ReferralRewardPreviewLineDto[];
  totalToman!: number;
}
