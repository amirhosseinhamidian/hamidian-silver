import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateSiteAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string | null;

  @ApiPropertyOptional({ enum: ['NONE', 'FIXED', 'DEADLINE'] })
  @IsOptional()
  @IsIn(['NONE', 'FIXED', 'DEADLINE'])
  countdownMode?: 'NONE' | 'FIXED' | 'DEADLINE';

  @ApiPropertyOptional({ nullable: true, minimum: 60, maximum: 604800 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(604800)
  durationSeconds?: number | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ctaLabel?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ctaHref?: string | null;
}

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 8, format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  headerCategoryIds?: string[];

  @ApiPropertyOptional({ type: () => UpdateSiteAnnouncementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSiteAnnouncementDto)
  announcement?: UpdateSiteAnnouncementDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  catalogHeroEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  catalogHeroTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  catalogHeroSubtitle?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  catalogHeroMediaId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  galleryName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  footerAbout?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  contactAddress?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  contactPhoneNumbers?: string[];

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  instagramUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  telegramUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  baleUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  seoSiteName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  seoDefaultTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  seoTitleTemplate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  seoDefaultDescription?: string;

  @IsOptional()
  @IsUUID('4')
  seoDefaultOgMediaId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  seoOrganizationName?: string;

  @IsOptional()
  @IsUUID('4')
  seoOrganizationLogoMediaId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  @MaxLength(1000, { each: true })
  seoSocialProfileUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoHomeTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoHomeDescription?: string | null;

  @IsOptional()
  @IsUUID('4')
  seoHomeOgMediaId?: string | null;
}
