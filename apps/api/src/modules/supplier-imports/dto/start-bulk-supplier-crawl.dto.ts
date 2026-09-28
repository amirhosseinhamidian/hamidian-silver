import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartBulkSupplierCrawlDto {
  @IsUUID('4')
  supplierSourceId!: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit!: number;

  @IsBoolean()
  stopAtKnown!: boolean;
}
