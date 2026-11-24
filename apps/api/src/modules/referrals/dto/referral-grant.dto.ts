import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ReferralGrantStatus, ReferralRiskAction } from '../../../generated/prisma/enums';
import { ReferralPageQueryDto } from './referral.dto';

export class ReferralGrantQueryDto extends ReferralPageQueryDto {
  @ApiPropertyOptional({ enum: [30, 90, 365] })
  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 90, 365])
  days?: number;

  @ApiPropertyOptional({ enum: ReferralGrantStatus })
  @IsOptional()
  @IsEnum(ReferralGrantStatus)
  status?: ReferralGrantStatus;
}

class ReferralGrantTotalsDto {
  registered!: number;
  converted!: number;
  pending!: number;
  approved!: number;
  rejected!: number;
  expired!: number;
  flagged!: number;
  grantedToman!: number;
  buyerDiscountToman!: number;
  revokedToman!: number;
  recoveryDueToman!: number;
}

class ReferralGrantRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  orderId!: string | null;

  @ApiProperty({ format: 'date-time' })
  claimedAt!: string;

  @ApiProperty({ enum: ReferralGrantStatus })
  status!: ReferralGrantStatus;

  @ApiProperty({ enum: ReferralRiskAction, nullable: true })
  riskAction!: ReferralRiskAction | null;

  @ApiProperty({ type: Number, nullable: true })
  policyVersion!: number | null;

  @ApiProperty({ type: String, nullable: true })
  ruleCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resultCode!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  creditExpiresAt!: string | null;

  grantedToman!: number;
  buyerDiscountToman!: number;
  revokedToman!: number;
  recoveryDueToman!: number;
}

export class ReferralGrantReportDto {
  @ApiProperty({ type: ReferralGrantTotalsDto })
  totals!: ReferralGrantTotalsDto;

  @ApiProperty({ type: [ReferralGrantRowDto] })
  items!: ReferralGrantRowDto[];

  page!: number;
  hasMore!: boolean;
}
