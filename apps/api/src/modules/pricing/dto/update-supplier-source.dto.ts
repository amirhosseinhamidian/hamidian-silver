import { SupplierCrawlerType } from '../../../generated/prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateSupplierSourceDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: true })
  baseUrl?: string;

  @IsOptional()
  @IsEnum(SupplierCrawlerType)
  crawlerType?: SupplierCrawlerType;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  adapterKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(60_000)
  crawlDelayMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxConcurrency?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
