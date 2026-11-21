import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CampaignStatus } from '../../../generated/prisma/enums';
import { CampaignAction } from '../campaign-lifecycle';

function Trimmed() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export class CampaignDraftDto {
  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 150)
  name!: string;

  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 500)
  goal!: string;

  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 96)
  channel!: string;

  @Type(() => Object)
  @IsBoolean()
  allProducts!: boolean;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 220, { each: true })
  productSlugs!: string[];

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 180, { each: true })
  categorySlugs!: string[];

  @Type(() => Object)
  @IsString()
  @Length(16, 24)
  startsTehran!: string;

  @Type(() => Object)
  @IsString()
  @Length(16, 24)
  endsTehran!: string;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  budgetToman!: number;

  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 500)
  message!: string;

  @Type(() => Object)
  @IsBoolean()
  bannerEnabled!: boolean;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(100)
  bannerPriority!: number;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @Type(() => Object)
  @IsUUID()
  mediaId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 1000)
  ctaPath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 80)
  ctaLabel?: string | null;
}

export class CreateCampaignDto extends CampaignDraftDto {
  @Type(() => Object)
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 64)
  trackingId!: string;

  @Trimmed()
  @Type(() => Object)
  @IsString()
  @Length(1, 96)
  trackingLabel!: string;
}

export class UpdateCampaignDto extends CampaignDraftDto {
  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class CampaignTransitionDto {
  @ApiProperty({ enum: CampaignAction })
  @Type(() => Object)
  @IsEnum(CampaignAction)
  action!: CampaignAction;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @Type(() => Object)
  @IsUUID('4')
  requestId!: string;
}

export class CampaignPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class CampaignMediaDto {
  id!: string;
  mimeType!: string;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty({ type: String, nullable: true })
  altText!: string | null;
}

export class CampaignSummaryDto {
  id!: string;
  slug!: string;
  name!: string;
  ownerId!: string;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  startsTehran!: string;
  endsTehran!: string;
  revision!: number;
}

export class CampaignRevisionDto {
  version!: number;
  action!: string;

  @ApiProperty({ type: String, nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  recordedAt!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  snapshot!: object;
}

export class CampaignListDto {
  @ApiProperty({ type: () => CampaignSummaryDto, isArray: true })
  items!: CampaignSummaryDto[];

  page!: number;
  hasMore!: boolean;
}

export class CampaignDetailDto extends CampaignSummaryDto {
  goal!: string;
  channel!: string;
  trackingId!: string;
  trackingLabel!: string;
  allProducts!: boolean;

  @ApiProperty({ type: String, isArray: true })
  productSlugs!: string[];

  @ApiProperty({ type: String, isArray: true })
  categorySlugs!: string[];

  budgetToman!: number;
  message!: string;
  bannerEnabled!: boolean;
  bannerPriority!: number;

  @ApiProperty({ type: String, nullable: true })
  ctaPath!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ctaLabel!: string | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;

  @ApiProperty({ type: () => CampaignRevisionDto, isArray: true })
  history!: CampaignRevisionDto[];

  historyPage!: number;
  hasMoreHistory!: boolean;
}

export class CampaignBannerDto {
  name!: string;
  message!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ type: String, nullable: true })
  ctaPath!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ctaLabel!: string | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;
}

export class PublicCampaignDto {
  @ApiProperty({ type: () => CampaignBannerDto, nullable: true })
  banner!: CampaignBannerDto | null;
}
