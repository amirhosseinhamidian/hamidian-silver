import { ApiProperty } from '@nestjs/swagger';

import { PublicSiteSettingsMediaDto } from './public-site-settings.dto';

export class AdminSiteSettingsDto {
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

  @ApiProperty({ nullable: true, format: 'uuid' })
  updatedByUserId!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  updatedAt!: string | null;
}
