import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StorefrontContentPageKey } from '../../../generated/prisma/enums';
import { PublicContentPageMediaDto, PublicContentPageSectionDto } from './public-content-page.dto';

export class AdminContentPageDto {
  @ApiProperty({ enum: StorefrontContentPageKey, enumName: 'StorefrontContentPageKey' })
  key!: StorefrontContentPageKey;

  title!: string;

  @ApiProperty({ nullable: true })
  eyebrow!: string | null;

  @ApiProperty({ nullable: true })
  subtitle!: string | null;

  @ApiProperty({ nullable: true })
  body!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  heroMediaId!: string | null;

  @ApiProperty({ nullable: true, type: () => PublicContentPageMediaDto })
  heroMedia!: PublicContentPageMediaDto | null;

  @ApiProperty({ type: () => PublicContentPageSectionDto, isArray: true })
  sections!: PublicContentPageSectionDto[];

  @ApiProperty({ nullable: true })
  seoTitle!: string | null;

  @ApiProperty({ nullable: true })
  seoDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  seoCanonicalPath?: string | null;

  @ApiPropertyOptional()
  seoNoIndex?: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  seoOgMediaId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: () => PublicContentPageMediaDto })
  seoOgMedia?: PublicContentPageMediaDto | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  updatedByUserId!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  updatedAt!: string | null;
}
