import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PublicCatalogProductListDto,
  PublicCatalogProductSummaryDto,
} from '../../catalog/dto/public-catalog-response.dto';
import { PublicCatalogFacetOptionDto } from '../../catalog/dto/public-catalog-facets.dto';
import { CampaignMediaDto } from './campaign.dto';

export const festivalSections = [
  'HERO',
  'COUNTDOWN',
  'HIGHLIGHTS',
  'CATEGORIES',
  'DISCOUNTS',
  'PICKS',
  'LOW_QUOTA',
  'BUDGET',
  'OFFERS',
  'PRODUCTS',
  'FAQ',
] as const;
export type FestivalSectionKind = (typeof festivalSections)[number];

export class FestivalThemeDto {
  @IsString() @Matches(/^#[0-9a-f]{6}$/i) background!: string;
  @IsString() @Matches(/^#[0-9a-f]{6}$/i) surface!: string;
  @IsString() @Matches(/^#[0-9a-f]{6}$/i) foreground!: string;
  @IsString() @Matches(/^#[0-9a-f]{6}$/i) accent!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  gradient?: string;

  @ApiProperty({ enum: ['NONE', 'DOTS', 'LINES'] })
  @IsIn(['NONE', 'DOTS', 'LINES'])
  decoration!: 'NONE' | 'DOTS' | 'LINES';

  @ApiProperty({ enum: ['STILL', 'SOFT'] })
  @IsIn(['STILL', 'SOFT'])
  motion!: 'STILL' | 'SOFT';
}

export class FestivalEntryDto {
  @IsString() @Length(1, 80) title!: string;
  @IsOptional() @IsString() @Length(1, 500) body?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2_147_483_647) maxPriceToman?: number;
  @IsOptional() @IsString() @Length(1, 220) actionPath?: string;
}

export class FestivalHeroSlideDto {
  @IsUUID() mediaId!: string;
  @IsOptional() @IsUUID() mobileMediaId?: string;
  @IsOptional() @IsUUID() stillMediaId?: string;
  @IsString() @Length(1, 100) title!: string;
  @IsOptional() @IsString() @Length(1, 240) subtitle?: string;
  @IsOptional() @IsString() @Length(1, 80) actionLabel?: string;
  @IsOptional() @IsString() @Length(1, 220) actionPath?: string;
}

export class FestivalSectionDto {
  @ApiProperty({ enum: festivalSections })
  @IsIn(festivalSections)
  kind!: FestivalSectionKind;

  @IsBoolean() enabled!: boolean;
  @IsString() @Length(1, 100) title!: string;
  @IsOptional() @IsString() @Length(16, 16) startsTehran?: string;
  @IsOptional() @IsString() @Length(16, 16) endsTehran?: string;

  @ApiProperty({ enum: ['GRID', 'STRIP'] })
  @IsIn(['GRID', 'STRIP'])
  layout!: 'GRID' | 'STRIP';

  @IsOptional() @IsInt() @Min(1) @Max(100) threshold?: number;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 24 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 220, { each: true })
  slugs?: string[];

  @ApiPropertyOptional({ type: () => FestivalEntryDto, isArray: true, maxItems: 12 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FestivalEntryDto)
  entries?: FestivalEntryDto[];

  @ApiPropertyOptional({ type: () => FestivalHeroSlideDto, isArray: true, maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FestivalHeroSlideDto)
  slides?: FestivalHeroSlideDto[];
}

export class FestivalDesignDto {
  @IsIn([1]) schemaVersion!: number;

  @ApiProperty({ type: () => FestivalThemeDto })
  @IsObject()
  @ValidateNested()
  @Type(() => FestivalThemeDto)
  theme!: FestivalThemeDto;

  @ApiProperty({ type: () => FestivalSectionDto, isArray: true, maxItems: 11 })
  @IsArray()
  @ArrayMaxSize(11)
  @ArrayUnique((row: FestivalSectionDto) => row?.kind)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => FestivalSectionDto)
  sections!: FestivalSectionDto[];
}

export class SaveFestivalDesignDto extends FestivalDesignDto {
  @IsInt() @Min(1) expectedRevision!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  saveThemeAs?: string;
}

export class RestoreFestivalDesignDto {
  @IsInt() @Min(1) expectedRevision!: number;
  @IsInt() @Min(1) revision!: number;
}

export class FestivalThemePresetDto {
  name!: string;

  @ApiProperty({ type: () => FestivalThemeDto })
  theme!: FestivalThemeDto;
}

export class FestivalDesignRevisionDto {
  revision!: number;
  recordedAt!: string;
}

export class FestivalDesignEditorDto {
  revision!: number;

  @ApiProperty({ type: () => FestivalDesignDto, nullable: true })
  design!: FestivalDesignDto | null;

  @ApiProperty({ type: () => FestivalThemePresetDto, isArray: true })
  presets!: FestivalThemePresetDto[];

  @ApiProperty({ type: () => FestivalDesignRevisionDto, isArray: true })
  history!: FestivalDesignRevisionDto[];

  @ApiProperty({ type: () => CampaignMediaDto, isArray: true })
  media!: CampaignMediaDto[];
}

export class PublicFestivalHeroSlideDto {
  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  mobileMedia!: CampaignMediaDto | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  stillMedia!: CampaignMediaDto | null;

  title!: string;
  subtitle?: string;
  actionLabel?: string;
  actionPath?: string;
}

export class PublicFestivalCategoryDto {
  slug!: string;
  name!: string;
  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;
}

export class PublicFestivalSectionDto {
  @ApiProperty({ enum: festivalSections })
  kind!: FestivalSectionKind;
  title!: string;

  @ApiProperty({ enum: ['GRID', 'STRIP'] })
  layout!: 'GRID' | 'STRIP';

  @ApiPropertyOptional({ type: () => PublicCatalogProductSummaryDto, isArray: true })
  products?: PublicCatalogProductSummaryDto[];

  @ApiPropertyOptional({ type: () => FestivalEntryDto, isArray: true })
  entries?: FestivalEntryDto[];

  @ApiPropertyOptional({ type: () => PublicFestivalHeroSlideDto, isArray: true })
  slides?: PublicFestivalHeroSlideDto[];

  @ApiPropertyOptional({ type: () => PublicFestivalCategoryDto, isArray: true })
  categories?: PublicFestivalCategoryDto[];
}

export class PublicFestivalDesignDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  refreshAt?: string;

  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  filterCategories!: PublicCatalogFacetOptionDto[];

  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  filterBrands!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => FestivalThemeDto })
  theme!: FestivalThemeDto;

  @ApiProperty({ type: () => PublicFestivalSectionDto, isArray: true })
  sections!: PublicFestivalSectionDto[];
}

export class FestivalPreviewDto {
  title!: string;
  story!: string;
  slug!: string;
  campaignId!: string;
  endsAt!: string;

  @ApiProperty({ type: () => PublicFestivalDesignDto })
  design!: PublicFestivalDesignDto;

  @ApiProperty({ type: () => PublicCatalogProductListDto })
  products!: PublicCatalogProductListDto;
}
