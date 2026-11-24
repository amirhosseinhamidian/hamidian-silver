import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const statuses = ['PENDING', 'FIRST_PURCHASE_CONFIRMED', 'EXPIRED'] as const;

export class ReferralClaimDto {
  @ApiProperty({ minLength: 24, maxLength: 24, pattern: '^[A-Za-z0-9_-]{24}$' })
  @IsString()
  @Type(() => Object)
  @Matches(/^[A-Za-z0-9_-]{24}$/)
  code!: string;
}

export class ReferralPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class IssuedReferralCodeDto {
  @ApiProperty({ minLength: 24, maxLength: 24 })
  code!: string;
}

export class ReferralHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: [...statuses] })
  status!: (typeof statuses)[number];

  @ApiProperty({ format: 'date-time' })
  claimedAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstPaidAt!: string | null;
}

export class ReceivedReferralDto extends ReferralHistoryItemDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  firstOrderId!: string | null;
}

class OutgoingReferralPageDto {
  @ApiProperty({ type: () => [ReferralHistoryItemDto] })
  items!: ReferralHistoryItemDto[];
  page!: number;
  hasMore!: boolean;
}

export class ReferralOverviewDto {
  enabled!: boolean;
  referrerEligible!: boolean;
  attributionDays!: number;

  @ApiProperty({ type: String, nullable: true })
  code!: string | null;

  @ApiProperty({ type: () => ReceivedReferralDto, nullable: true })
  incoming!: ReceivedReferralDto | null;

  @ApiProperty({ type: () => OutgoingReferralPageDto })
  outgoing!: OutgoingReferralPageDto;
}

export class ReferralCheckoutAvailabilityDto {
  available!: boolean;
}
