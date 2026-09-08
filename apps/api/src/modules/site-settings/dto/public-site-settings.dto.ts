import { ApiProperty } from '@nestjs/swagger';

export class PublicSiteSettingsMediaDto {
  @ApiProperty({
    nullable: true,
    format: 'uri',
  })
  url!: string | null;

  @ApiProperty({
    nullable: true,
  })
  altText!: string | null;
}

export class PublicSiteSettingsHeaderCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  slug!: string;
}

export class PublicSiteAnnouncementDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({ enum: ['NONE', 'FIXED', 'DEADLINE'] })
  countdownMode!: 'NONE' | 'FIXED' | 'DEADLINE';

  @ApiProperty({ nullable: true })
  durationSeconds!: number | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  endsAt!: string | null;

  @ApiProperty({ nullable: true })
  ctaLabel!: string | null;

  @ApiProperty({ nullable: true })
  ctaHref!: string | null;
}

export class PublicSiteSettingsDto {
  @ApiProperty({ type: () => PublicSiteSettingsHeaderCategoryDto, isArray: true })
  headerCategories!: PublicSiteSettingsHeaderCategoryDto[];

  @ApiProperty({ type: () => PublicSiteAnnouncementDto })
  announcement!: PublicSiteAnnouncementDto;

  @ApiProperty()
  catalogHeroEnabled!: boolean;

  @ApiProperty({
    nullable: true,
  })
  catalogHeroTitle!: string | null;

  @ApiProperty({
    nullable: true,
  })
  catalogHeroSubtitle!: string | null;

  @ApiProperty({
    nullable: true,
    type: () => PublicSiteSettingsMediaDto,
  })
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
}
