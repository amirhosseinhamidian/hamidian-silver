import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { GuideArticleFormat, GuideArticleStatus } from '../../../generated/prisma/enums';
import { GUIDE_SLUG_PATTERN } from './guide-article-input.dto';

export class PublicGuideArticlesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(GuideArticleFormat)
  format?: GuideArticleFormat;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}

export class AdminGuideArticlesQueryDto extends PublicGuideArticlesQueryDto {
  @IsOptional()
  @IsEnum(GuideArticleStatus)
  status?: GuideArticleStatus;
}

export class PublicRelatedGuideArticlesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(GUIDE_SLUG_PATTERN)
  product?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','));
    return typeof value === 'string' ? value.split(',') : value;
  })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Matches(GUIDE_SLUG_PATTERN, { each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  @Matches(GUIDE_SLUG_PATTERN)
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  limit?: number;
}
