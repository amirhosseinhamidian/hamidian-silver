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
}
