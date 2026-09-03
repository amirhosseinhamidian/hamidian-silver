import { ApiProperty } from '@nestjs/swagger';
import { SizeMode } from '../../../generated/prisma/enums';

export class PublicCatalogMediaDto {
  storageKey!: string;
  mimeType!: string;

  @ApiProperty({ type: String, nullable: true })
  altText!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;
}

export class PublicCatalogCategoryDto {
  id!: string;
  name!: string;
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  sortOrder!: number;

  @ApiProperty({ type: () => PublicCatalogMediaDto, nullable: true })
  image!: PublicCatalogMediaDto | null;
}

export class PublicCatalogBrandDto {
  id!: string;
  name!: string;
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: () => PublicCatalogMediaDto, nullable: true })
  image!: PublicCatalogMediaDto | null;
}

export class PublicCatalogCountryDto {
  id!: string;
  name!: string;
  slug!: string;
  isoCode!: string;
}

export class PublicCatalogSizeDto {
  id!: string;
  code!: string;
  label!: string;
}

export class PublicCatalogVariantDto {
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  weightGrams!: number | null;

  @ApiProperty({ type: () => PublicCatalogSizeDto, nullable: true })
  size!: PublicCatalogSizeDto | null;

  availableQuantity!: number;
  isAvailable!: boolean;
}

export class PublicCatalogProductSummaryDto {
  id!: string;
  name!: string;
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  salePriceToman!: number | null;

  @ApiProperty({ enum: SizeMode })
  sizeMode!: SizeMode;

  @ApiProperty({ type: () => PublicCatalogBrandDto, nullable: true })
  brand!: PublicCatalogBrandDto | null;

  @ApiProperty({ type: () => PublicCatalogCategoryDto, isArray: true })
  categories!: PublicCatalogCategoryDto[];

  @ApiProperty({ type: () => PublicCatalogMediaDto, nullable: true })
  primaryMedia!: PublicCatalogMediaDto | null;

  availableQuantity!: number;
  isAvailable!: boolean;
}

export class PublicCatalogProductDetailDto extends PublicCatalogProductSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: () => PublicCatalogCountryDto, nullable: true })
  country!: PublicCatalogCountryDto | null;

  @ApiProperty({ type: () => PublicCatalogVariantDto, isArray: true })
  variants!: PublicCatalogVariantDto[];

  @ApiProperty({ type: () => PublicCatalogMediaDto, isArray: true })
  media!: PublicCatalogMediaDto[];
}

export class PublicCatalogProductListDto {
  @ApiProperty({ type: () => PublicCatalogProductSummaryDto, isArray: true })
  items!: PublicCatalogProductSummaryDto[];

  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}
