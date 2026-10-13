import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { GUIDE_SLUG_PATTERN, GUIDE_TOPIC_CANONICAL_PATH_PATTERN } from './guide-article-input.dto';

export class CreateGuideTopicDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 180)
  @Matches(GUIDE_SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  coverMediaId?: string | null;

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
  @Matches(GUIDE_TOPIC_CANONICAL_PATH_PATTERN)
  seoCanonicalPath?: string | null;

  @IsOptional()
  @IsBoolean()
  seoNoIndex?: boolean;

  @IsOptional()
  @IsUUID('4')
  seoOgMediaId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGuideTopicDto extends PartialType(CreateGuideTopicDto) {}
