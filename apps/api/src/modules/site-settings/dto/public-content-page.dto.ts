import { ApiProperty } from '@nestjs/swagger';

import { StorefrontContentPageKey } from '../../../generated/prisma/enums';

export class PublicContentPageMediaDto {
  @ApiProperty({ nullable: true, format: 'uri' })
  url!: string | null;

  @ApiProperty({ nullable: true })
  altText!: string | null;

  @ApiProperty({ nullable: true })
  width!: number | null;

  @ApiProperty({ nullable: true })
  height!: number | null;
}

export class PublicContentPageSectionDto {
  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  body!: string | null;
}

export class PublicContentPageDto {
  @ApiProperty({ enum: StorefrontContentPageKey, enumName: 'StorefrontContentPageKey' })
  key!: StorefrontContentPageKey;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  eyebrow!: string | null;

  @ApiProperty({ nullable: true })
  subtitle!: string | null;

  @ApiProperty({ nullable: true })
  body!: string | null;

  @ApiProperty({ nullable: true, type: () => PublicContentPageMediaDto })
  heroMedia!: PublicContentPageMediaDto | null;

  @ApiProperty({ type: () => PublicContentPageSectionDto, isArray: true })
  sections!: PublicContentPageSectionDto[];

  @ApiProperty({ nullable: true })
  seoTitle!: string | null;

  @ApiProperty({ nullable: true })
  seoDescription!: string | null;
}
