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

export class PublicSiteSettingsDto {
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
