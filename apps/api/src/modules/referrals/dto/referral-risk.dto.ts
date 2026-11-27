import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BooleanField, Integer } from '../../reward-policies/dto/reward-policy.dto';
import { ReferralPageQueryDto } from './referral.dto';

export const riskCodes = [
  'SELF_REFERRAL',
  'SHARED_DEVICE',
  'SHARED_NETWORK',
  'SHARED_ADDRESS',
  'SHARED_RECIPIENT',
  'VERIFIED_PAYMENT_REUSE',
  'REFERRAL_FREQUENCY',
  'CANCELLED_ORDERS',
  'FAST_PAYMENT',
] as const;
export type RiskCode = (typeof riskCodes)[number];
export const riskActions = ['ALLOW', 'REVIEW', 'HOLD', 'REJECT'] as const;
export type RiskAction = (typeof riskActions)[number];

export class ReferralRiskSignalDto {
  @ApiProperty({ enum: [...riskCodes] })
  @IsIn(riskCodes)
  code!: RiskCode;
  @BooleanField() enabled!: boolean;
  @Integer(1, 90) windowDays!: number;
  @Integer(1, 100) weight!: number;
  @Integer(1, 86_400) threshold!: number;
}

export class ReferralRiskExceptionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attributionId!: string;

  @ApiProperty({ enum: [...riskCodes], isArray: true, minItems: 1, maxItems: 9 })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsIn(riskCodes, { each: true })
  codes!: RiskCode[];

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  until!: string;

  @Type(() => Object)
  @IsString()
  @Length(3, 250)
  reason!: string;
}

export class ReferralRiskPolicyDto {
  @Integer(1, 9) minSignals!: number;
  @Integer(1, 900) reviewAt!: number;
  @Integer(1, 900) holdAt!: number;
  @Integer(1, 900) rejectAt!: number;
  @Integer(1, 720) reviewHours!: number;
  @Integer(1, 90) retentionDays!: number;

  @ApiProperty({ type: () => [ReferralRiskSignalDto] })
  @IsArray()
  @ArrayMinSize(9)
  @ArrayMaxSize(9)
  @ArrayUnique((item: ReferralRiskSignalDto | null) => item?.code)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRiskSignalDto)
  signals!: ReferralRiskSignalDto[];

  @ApiProperty({ type: () => [ReferralRiskExceptionDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((item: ReferralRiskExceptionDto | null) => item?.attributionId?.toLowerCase())
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRiskExceptionDto)
  exceptions!: ReferralRiskExceptionDto[];
}

export class PublishReferralRiskPolicyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedVersion!: number | null;

  @ApiProperty({ type: () => ReferralRiskPolicyDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferralRiskPolicyDto)
  definition!: ReferralRiskPolicyDto;
}

export class ReferralRiskPolicyRecordDto {
  @ApiProperty({ type: Number, nullable: true }) version!: number | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) publishedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) publishedById!: string | null;
  @ApiProperty({ type: () => ReferralRiskPolicyDto }) definition!: ReferralRiskPolicyDto;
}

export class ReferralRiskPolicyOverviewDto {
  @ApiProperty({ type: () => ReferralRiskPolicyRecordDto }) active!: ReferralRiskPolicyRecordDto;
  @ApiProperty({ type: () => [ReferralRiskPolicyRecordDto] })
  history!: ReferralRiskPolicyRecordDto[];
  hasMore!: boolean;
  page!: number;
}

export class ReferralRiskQueueQueryDto extends ReferralPageQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'resolved', 'all'] })
  @IsOptional()
  @IsIn(['open', 'resolved', 'all'])
  queue?: 'open' | 'resolved' | 'all';
}

export class ReviewReferralRiskDto {
  @Integer(1) expectedRevision!: number;

  @ApiProperty({ enum: ['ALLOW', 'HOLD', 'REJECT'] })
  @IsIn(['ALLOW', 'HOLD', 'REJECT'])
  action!: 'ALLOW' | 'HOLD' | 'REJECT';

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Type(() => Object)
  @IsString()
  @Length(3, 250)
  reason!: string;
}

const confidenceLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskConfidence = (typeof confidenceLevels)[number];

export class ReferralRiskEvidenceDto {
  @ApiProperty({ enum: [...riskCodes] }) code!: RiskCode;
  value!: number;
  weight!: number;
}

export class ReferralRiskMetricDto {
  @ApiProperty({ enum: [...riskCodes] })
  @IsIn(riskCodes)
  code!: RiskCode;
  @Integer(0, 2_147_483_647) value!: number;
}

export class SimulateReferralRiskDto {
  @ApiProperty({ type: () => ReferralRiskPolicyDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferralRiskPolicyDto)
  definition!: ReferralRiskPolicyDto;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  attributionId?: string;

  @ApiProperty({ type: () => [ReferralRiskMetricDto] })
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique((item: ReferralRiskMetricDto | null) => item?.code)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ReferralRiskMetricDto)
  metrics!: ReferralRiskMetricDto[];
}

export class ReferralRiskPreviewDto {
  @ApiProperty({ enum: [...riskActions] }) action!: RiskAction;
  @ApiProperty({ enum: [...confidenceLevels] }) confidence!: RiskConfidence;
  score!: number;
  @ApiProperty({ type: () => [ReferralRiskEvidenceDto] }) evidence!: ReferralRiskEvidenceDto[];
}

class ReferralRiskReviewDto {
  revision!: number;
  @ApiProperty({ enum: [...riskActions] }) fromAction!: RiskAction;
  @ApiProperty({ enum: [...riskActions] }) action!: RiskAction;
  reason!: string;
  @ApiProperty({ format: 'uuid' }) actorUserId!: string;
  @ApiProperty({ format: 'date-time' }) recordedAt!: string;
}

export class ReferralRiskCaseDto {
  @ApiProperty({ format: 'uuid' }) attributionId!: string;
  @ApiProperty({ type: Number, nullable: true }) policyVersion!: number | null;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty({ enum: [...riskActions] }) autoAction!: RiskAction;
  @ApiProperty({ enum: [...riskActions] }) action!: RiskAction;
  @ApiProperty({ enum: [...confidenceLevels] }) confidence!: RiskConfidence;
  score!: number;
  revision!: number;
  @ApiProperty({ format: 'date-time' }) assessedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) dueAt!: string | null;
  overdue!: boolean;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: () => [ReferralRiskEvidenceDto], nullable: true }) evidence!:
    ReferralRiskEvidenceDto[] | null;
  @ApiProperty({ type: () => [ReferralRiskReviewDto] }) reviews!: ReferralRiskReviewDto[];
}

export class ReferralRiskQueueDto {
  @ApiProperty({ type: () => [ReferralRiskCaseDto] }) items!: ReferralRiskCaseDto[];
  page!: number;
  hasMore!: boolean;
}
