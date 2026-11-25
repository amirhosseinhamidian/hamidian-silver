import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
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
  CampaignBannerSlot,
  CampaignCollectionMode,
  CampaignLandingMode,
  CampaignNavigationEffect,
} from '../../../generated/prisma/enums';
import { PublicCatalogFacetsQueryDto } from '../../catalog/dto/public-catalog-facets.dto';
import { PublicCatalogSort } from '../../catalog/dto/public-catalog-query.dto';
import { PublicCatalogProductListDto } from '../../catalog/dto/public-catalog-response.dto';
import { CampaignMediaDto } from './campaign.dto';
import { CampaignPlacementDisplayDto } from './campaign-placement-display.dto';
import { PublicFestivalDesignDto } from './festival-design.dto';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CampaignCollectionFiltersDto extends PickType(PublicCatalogFacetsQueryDto, [
  'categories',
  'brands',
  'attributes',
  'minPriceToman',
  'maxPriceToman',
]) {
  @ApiPropertyOptional({ enum: PublicCatalogSort })
  @IsOptional()
  @Type(() => Object)
  @IsEnum(PublicCatalogSort)
  sort?: PublicCatalogSort;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 999 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(999)
  minimumQuantity?: number;
}

export class CampaignPlacementAppearanceDto {
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mediaId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mobileMediaId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  stillMediaId?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 48, maximum: 320 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(48)
  @Max(320)
  desktopHeight?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 48, maximum: 320 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(48)
  @Max(320)
  mobileHeight?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-f]{6}$/i)
  textColor?: string | null;

  @ApiPropertyOptional({ enum: CampaignNavigationEffect, nullable: true })
  @IsOptional()
  @IsEnum(CampaignNavigationEffect)
  navigationEffect?: CampaignNavigationEffect | null;

  @ApiPropertyOptional({ type: () => CampaignPlacementDisplayDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignPlacementDisplayDto)
  display?: CampaignPlacementDisplayDto;
}

export class CampaignPlacementDraftDto {
  @ApiProperty({ enum: CampaignBannerSlot })
  @IsEnum(CampaignBannerSlot)
  slot!: CampaignBannerSlot;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(1, 220)
  targetSlug?: string | null;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(100)
  priority!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(16, 24)
  startsTehran?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(16, 24)
  endsTehran?: string | null;

  @ApiPropertyOptional({ type: () => CampaignPlacementAppearanceDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignPlacementAppearanceDto)
  appearance?: CampaignPlacementAppearanceDto;
}

export class CampaignLandingDraftDto {
  @Type(() => Object)
  @IsString()
  @Length(1, 64)
  @Matches(slugPattern)
  slug!: string;

  @ApiProperty({ enum: CampaignLandingMode })
  @IsEnum(CampaignLandingMode)
  seoMode!: CampaignLandingMode;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Type(() => Object)
  @IsString()
  @Length(1, 150)
  title!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Type(() => Object)
  @IsString()
  @Length(1, 3000)
  story!: string;

  @ApiProperty({ enum: CampaignCollectionMode })
  @IsEnum(CampaignCollectionMode)
  collectionMode!: CampaignCollectionMode;

  @ApiProperty({ type: () => CampaignCollectionFiltersDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignCollectionFiltersDto)
  filters!: CampaignCollectionFiltersDto;

  @ApiProperty({ type: String, isArray: true, maxItems: 48 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  @Length(1, 220, { each: true })
  manualProductSlugs!: string[];

  @ApiProperty({ type: () => CampaignPlacementDraftDto, isArray: true, maxItems: 5 })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique((placement: CampaignPlacementDraftDto) => placement?.slot)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CampaignPlacementDraftDto)
  placements!: CampaignPlacementDraftDto[];
}

export class SaveCampaignLandingDto extends CampaignLandingDraftDto {
  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class CampaignPlacementMediaDto {
  @ApiProperty({ enum: CampaignBannerSlot })
  slot!: CampaignBannerSlot;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  mobileMedia!: CampaignMediaDto | null;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  stillMedia!: CampaignMediaDto | null;
}

export class CampaignLandingEditorDto {
  @ApiProperty({ type: () => CampaignLandingDraftDto, nullable: true })
  landing!: CampaignLandingDraftDto | null;

  revision!: number;

  @ApiPropertyOptional({ type: () => CampaignPlacementMediaDto, isArray: true })
  placementMedia?: CampaignPlacementMediaDto[];

  @ApiPropertyOptional({ type: () => FestivalPublishedVersionDto, isArray: true })
  publishedVersions?: FestivalPublishedVersionDto[];
}

export class FestivalPublishedVersionDto {
  version!: number;
  recordedAt!: string;
}

export class RestoreFestivalPublicationDto {
  @IsInt() @Min(1) expectedRevision!: number;
  @IsInt() @Min(1) version!: number;
}

export class CampaignPlacementQueryDto {
  @ApiProperty({ enum: CampaignBannerSlot })
  @IsEnum(CampaignBannerSlot)
  slot!: CampaignBannerSlot;

  @ApiPropertyOptional({ type: String, maxLength: 220 })
  @IsOptional()
  @IsString()
  @Length(1, 220)
  slug?: string;
}

export class CampaignLandingPreviewDto {
  total!: number;
}

export class PublicCampaignLandingQueryDto extends PickType(PublicCatalogFacetsQueryDto, [
  'scopeCategory',
  'scopeBrand',
  'sort',
]) {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  minPriceToman?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maxPriceToman?: number;

  @ApiPropertyOptional({ type: String, enum: ['1'] })
  @IsOptional()
  @Matches(/^1$/)
  productsOnly?: string;
}

export class PublicCampaignLandingDto {
  @ApiPropertyOptional({ type: Boolean })
  isFestival?: boolean;

  slug!: string;
  title!: string;
  story!: string;

  @ApiProperty({ enum: CampaignLandingMode })
  seoMode!: CampaignLandingMode;

  active!: boolean;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  campaignId?: string;

  @ApiPropertyOptional({ type: Number })
  publicationVersion?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  endsAt?: string;

  @ApiPropertyOptional({ type: () => PublicFestivalDesignDto })
  design?: PublicFestivalDesignDto;

  @ApiProperty({ type: () => CampaignMediaDto, nullable: true })
  media!: CampaignMediaDto | null;

  ctaPath!: string;
  ctaLabel!: string;

  @ApiProperty({ type: () => PublicCatalogProductListDto })
  products!: PublicCatalogProductListDto;
}

export class CampaignSitemapEntryDto {
  slug!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CampaignSitemapDto {
  @ApiProperty({ type: () => CampaignSitemapEntryDto, isArray: true })
  entries!: CampaignSitemapEntryDto[];
}
