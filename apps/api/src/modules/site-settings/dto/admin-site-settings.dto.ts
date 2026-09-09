import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PublicSiteAnnouncementDto,
  PublicSiteSettingsMediaDto,
} from './public-site-settings.dto';

export class AdminSiteSettingsDto {
  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  headerCategoryIds!: string[];

  @ApiProperty({ type: () => PublicSiteAnnouncementDto })
  announcement!: PublicSiteAnnouncementDto;

  @ApiProperty()
  catalogHeroEnabled!: boolean;

  @ApiProperty({ nullable: true })
  catalogHeroTitle!: string | null;

  @ApiProperty({ nullable: true })
  catalogHeroSubtitle!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  catalogHeroMediaId!: string | null;

  @ApiProperty({ nullable: true, type: () => PublicSiteSettingsMediaDto })
  catalogHeroMedia!: PublicSiteSettingsMediaDto | null;

  @ApiProperty({ nullable: true })
  galleryName!: string | null;

  @ApiProperty({ nullable: true })
  footerAbout!: string | null;

  @ApiProperty({ nullable: true })
  contactAddress!: string | null;

  @ApiProperty({ type: String, isArray: true })
  contactPhoneNumbers!: string[];

  @ApiProperty({ nullable: true })
  contactEmail!: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  instagramUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  telegramUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uri' })
  baleUrl!: string | null;

  @ApiPropertyOptional()
  seoSiteName?: string;

  @ApiPropertyOptional()
  seoDefaultTitle?: string;

  @ApiPropertyOptional()
  seoTitleTemplate?: string;

  @ApiPropertyOptional()
  seoDefaultDescription?: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  seoDefaultOgMediaId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: () => PublicSiteSettingsMediaDto })
  seoDefaultOgMedia?: PublicSiteSettingsMediaDto | null;

  @ApiPropertyOptional()
  seoOrganizationName?: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  seoOrganizationLogoMediaId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: () => PublicSiteSettingsMediaDto })
  seoOrganizationLogoMedia?: PublicSiteSettingsMediaDto | null;

  @ApiPropertyOptional({ type: String, isArray: true, format: 'uri' })
  seoSocialProfileUrls?: string[];

  @ApiPropertyOptional({ nullable: true })
  seoHomeTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  seoHomeDescription?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  seoHomeOgMediaId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: () => PublicSiteSettingsMediaDto })
  seoHomeOgMedia?: PublicSiteSettingsMediaDto | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  updatedByUserId!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  updatedAt!: string | null;
}
