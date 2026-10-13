import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  GuideArticleFormat,
  GuideArticleStatus,
  GuideBlockType,
  GuideProductRecommendationMode,
} from '../../../generated/prisma/enums';

export const GUIDE_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
export const GUIDE_CANONICAL_PATH_PATTERN =
  /^\/guide\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^%\\\s?#]+$/;
export const GUIDE_TOPIC_CANONICAL_PATH_PATTERN =
  /^\/guide\/topics\/(?!\/)(?!\.{1,2}(?:\/|$))(?!.*\/\.{1,2}(?:\/|$))[^%\\\s?#]+$/;

export class GuideArticleBlockInputDto {
  @IsEnum(GuideBlockType)
  type!: GuideBlockType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  variant?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  anchorId?: string | null;

  @IsOptional()
  @IsUUID('4')
  primaryMediaId?: string | null;

  @IsObject()
  content!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class CreateGuideArticleDto {
  @IsString()
  @Length(1, 220)
  title!: string;

  @IsString()
  @Length(1, 220)
  @Matches(GUIDE_SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  eyebrow?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  excerpt?: string | null;

  @IsOptional()
  @IsEnum(GuideArticleFormat)
  format?: GuideArticleFormat;

  @IsOptional()
  @IsEnum(GuideArticleStatus)
  status?: GuideArticleStatus;

  @IsOptional()
  @IsUUID('4')
  heroMediaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  heroMobileMediaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  cardMediaId?: string | null;

  @IsOptional()
  @IsEnum(GuideProductRecommendationMode)
  productRecommendationMode?: GuideProductRecommendationMode;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(GUIDE_CANONICAL_PATH_PATTERN)
  seoCanonicalPath?: string | null;

  @IsOptional()
  @IsBoolean()
  seoNoIndex?: boolean;

  @IsOptional()
  @IsUUID('4')
  seoOgMediaId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  searchKeywords?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  readingTimeMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GuideArticleBlockInputDto)
  blocks?: GuideArticleBlockInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  topicIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  brandIds?: string[];
}

export class UpdateGuideArticleDto extends PartialType(CreateGuideArticleDto) {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class GuideArticleStatusDto {
  @IsEnum(GuideArticleStatus)
  status!: GuideArticleStatus;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
