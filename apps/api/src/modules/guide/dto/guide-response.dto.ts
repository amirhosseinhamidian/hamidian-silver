import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GuideArticleFormat,
  GuideArticleStatus,
  GuideBlockType,
  GuideProductRecommendationMode,
} from '../../../generated/prisma/enums';

export class GuideMediaDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
  @ApiProperty() mimeType!: string;
  @ApiPropertyOptional({ nullable: true }) altText!: string | null;
}

export class GuideTopicDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) coverMedia!: GuideMediaDto | null;
  @ApiPropertyOptional({ nullable: true }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoCanonicalPath!: string | null;
  @ApiProperty() seoNoIndex!: boolean;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
}

export class GuideArticleBlockDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: GuideBlockType }) type!: GuideBlockType;
  @ApiPropertyOptional({ nullable: true }) variant!: string | null;
  @ApiPropertyOptional({ nullable: true }) anchorId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) primaryMedia!: GuideMediaDto | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) content!: Record<string, unknown>;
  @ApiProperty() sortOrder!: number;
}

export class GuideArticleSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) eyebrow!: string | null;
  @ApiPropertyOptional({ nullable: true }) excerpt!: string | null;
  @ApiProperty({ enum: GuideArticleFormat }) format!: GuideArticleFormat;
  @ApiProperty({ enum: GuideArticleStatus }) status!: GuideArticleStatus;
  @ApiProperty({ enum: GuideProductRecommendationMode })
  productRecommendationMode!: GuideProductRecommendationMode;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) heroMedia!: GuideMediaDto | null;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) cardMedia!: GuideMediaDto | null;
  @ApiPropertyOptional({ nullable: true }) seoCanonicalPath!: string | null;
  @ApiProperty() seoNoIndex!: boolean;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) seoOgMedia!: GuideMediaDto | null;
  @ApiPropertyOptional({ nullable: true }) readingTimeMinutes!: number | null;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty() blockCount!: number;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  publishedAt!: Date | null;
  @ApiProperty({ type: GuideTopicDto, isArray: true }) topics!: GuideTopicDto[];
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class GuideRelatedProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ nullable: true }) salePriceToman!: number | null;
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto }) primaryMedia!: GuideMediaDto | null;
}

export class GuideRelatedCollectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class GuideArticleDto extends GuideArticleSummaryDto {
  @ApiPropertyOptional({ nullable: true, type: GuideMediaDto })
  heroMobileMedia!: GuideMediaDto | null;
  @ApiPropertyOptional({ nullable: true }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription!: string | null;
  @ApiProperty({ type: String, isArray: true }) searchKeywords!: string[];
  @ApiProperty({ type: GuideArticleBlockDto, isArray: true }) blocks!: GuideArticleBlockDto[];
  @ApiProperty({ type: String, isArray: true }) productIds!: string[];
  @ApiProperty({ type: GuideRelatedProductDto, isArray: true })
  relatedProducts!: GuideRelatedProductDto[];
  @ApiProperty({ type: String, isArray: true }) categoryIds!: string[];
  @ApiProperty({ type: GuideRelatedCollectionDto, isArray: true })
  relatedCategories!: GuideRelatedCollectionDto[];
  @ApiProperty({ type: String, isArray: true }) brandIds!: string[];
  @ApiProperty({ type: GuideRelatedCollectionDto, isArray: true })
  relatedBrands!: GuideRelatedCollectionDto[];
  @ApiProperty({ type: GuideArticleSummaryDto, isArray: true })
  relatedArticles!: GuideArticleSummaryDto[];
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
}

export class GuideArticleListDto {
  @ApiProperty({ type: GuideArticleSummaryDto, isArray: true }) items!: GuideArticleSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
