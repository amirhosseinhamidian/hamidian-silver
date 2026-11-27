import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MergeCategoryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  targetCategoryId!: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CategoryMergeResultDto {
  merged!: boolean;
  childCount!: number;
  sourceProductCount!: number;
  targetProductCount!: number;
  sharedProductCount!: number;
  sourcePath!: string;
  targetPath!: string;
}
