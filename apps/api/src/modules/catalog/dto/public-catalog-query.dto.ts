import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export enum PublicCatalogSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  NAME_ASC = 'name-asc',
}

export class PublicCatalogQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 48, default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  category?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  brand?: string;

  @ApiPropertyOptional({ enum: PublicCatalogSort, default: PublicCatalogSort.NEWEST })
  @IsOptional()
  @IsEnum(PublicCatalogSort)
  sort?: PublicCatalogSort;
}
