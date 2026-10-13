import { ApiProperty } from '@nestjs/swagger';
import { StorefrontContentPageKey } from '../../../generated/prisma/enums';

class PublicSeoSitemapDocumentDto {
  @ApiProperty({ type: String, nullable: true })
  seoCanonicalPath!: string | null;

  seoNoIndex!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  imageUrl!: string | null;
}

export class PublicSeoSitemapProductDto extends PublicSeoSitemapDocumentDto {
  id!: string;
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  brandId!: string | null;

  @ApiProperty({ type: String, isArray: true })
  categoryIds!: string[];
}

export class PublicSeoSitemapCategoryDto extends PublicSeoSitemapDocumentDto {
  id!: string;
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;
}

export class PublicSeoSitemapBrandDto extends PublicSeoSitemapDocumentDto {
  id!: string;
  slug!: string;
}

export class PublicSeoSitemapContentPageDto extends PublicSeoSitemapDocumentDto {
  @ApiProperty({ enum: StorefrontContentPageKey })
  key!: StorefrontContentPageKey;
}

export class PublicSeoSitemapResponseDto {
  @ApiProperty({ type: () => PublicSeoSitemapProductDto, isArray: true })
  products!: PublicSeoSitemapProductDto[];

  @ApiProperty({ type: () => PublicSeoSitemapCategoryDto, isArray: true })
  categories!: PublicSeoSitemapCategoryDto[];

  @ApiProperty({ type: () => PublicSeoSitemapBrandDto, isArray: true })
  brands!: PublicSeoSitemapBrandDto[];

  @ApiProperty({ type: () => PublicSeoSitemapContentPageDto, isArray: true })
  contentPages!: PublicSeoSitemapContentPageDto[];
}
