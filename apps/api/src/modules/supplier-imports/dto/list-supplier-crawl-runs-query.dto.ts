import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListSupplierCrawlRunsQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  view: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}
