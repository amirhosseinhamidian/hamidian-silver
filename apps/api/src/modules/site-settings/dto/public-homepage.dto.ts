import { ApiProperty } from '@nestjs/swagger';

import {
  PublicCatalogBrandDto,
  PublicCatalogCategoryDto,
  PublicCatalogCountryDto,
  PublicCatalogMediaDto,
  PublicCatalogProductSummaryDto,
} from '../../catalog/dto/public-catalog-response.dto';

export class PublicHomepageHeroSlideDto {
  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true })
  subtitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actionLabel!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actionHref!: string | null;

  @ApiProperty({ type: () => PublicCatalogMediaDto })
  media!: PublicCatalogMediaDto;
}

export class PublicHomepageFeaturedCategoryDto extends PublicCatalogCategoryDto {
  priority!: number;
}

export class PublicHomepageManufacturerCountryDto extends PublicCatalogCountryDto {
  priority!: number;

  @ApiProperty({ type: () => PublicCatalogMediaDto, nullable: true })
  image!: PublicCatalogMediaDto | null;
}

export class PublicHomepageDto {
  @ApiProperty({ type: () => PublicHomepageHeroSlideDto, isArray: true })
  primaryHeroSlides!: PublicHomepageHeroSlideDto[];

  @ApiProperty({ type: () => PublicHomepageHeroSlideDto, nullable: true })
  secondaryHero!: PublicHomepageHeroSlideDto | null;

  @ApiProperty({ type: () => PublicCatalogProductSummaryDto, isArray: true })
  newProducts!: PublicCatalogProductSummaryDto[];

  @ApiProperty({ type: () => PublicHomepageFeaturedCategoryDto, isArray: true })
  featuredCategories!: PublicHomepageFeaturedCategoryDto[];

  @ApiProperty({ type: () => PublicCatalogProductSummaryDto, isArray: true })
  popularProducts!: PublicCatalogProductSummaryDto[];

  @ApiProperty({ type: () => PublicCatalogBrandDto, isArray: true })
  featuredBrands!: PublicCatalogBrandDto[];

  manufacturerCountriesEnabled!: boolean;

  @ApiProperty({ type: () => PublicHomepageManufacturerCountryDto, isArray: true })
  manufacturerCountries!: PublicHomepageManufacturerCountryDto[];
}
