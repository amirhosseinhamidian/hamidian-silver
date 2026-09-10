import { ApiProperty } from '@nestjs/swagger';

export class AdminHomepageHeroMediaDto {
  id!: string;

  @ApiProperty({ nullable: true, format: 'uri' })
  url!: string | null;

  mimeType!: string;

  @ApiProperty({ nullable: true })
  altText!: string | null;
}

export class AdminHomepageHeroSlideDto {
  id!: string;
  mediaId!: string;

  @ApiProperty({ type: () => AdminHomepageHeroMediaDto })
  media!: AdminHomepageHeroMediaDto;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true })
  subtitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actionLabel!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actionHref!: string | null;

  sortOrder!: number;
  isActive!: boolean;
}

export class AdminHomepageSelectionDto {
  id!: string;
  priority!: number;
}

export class AdminHomepageDto {
  @ApiProperty({ type: () => AdminHomepageHeroSlideDto, isArray: true })
  primaryHeroSlides!: AdminHomepageHeroSlideDto[];

  @ApiProperty({ type: () => AdminHomepageHeroSlideDto, nullable: true })
  secondaryHero!: AdminHomepageHeroSlideDto | null;

  @ApiProperty({ type: () => AdminHomepageSelectionDto, isArray: true })
  featuredCategories!: AdminHomepageSelectionDto[];

  @ApiProperty({ type: () => AdminHomepageSelectionDto, isArray: true })
  popularProducts!: AdminHomepageSelectionDto[];

  manufacturerCountriesEnabled!: boolean;

  @ApiProperty({ type: () => AdminHomepageSelectionDto, isArray: true })
  manufacturerCountries!: AdminHomepageSelectionDto[];

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  updatedAt!: string | null;
}
