import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';

export class CatalogMerchandisingDto {
  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: Boolean })
  pinned!: boolean;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100 })
  weight!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startsAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endsAt!: string | null;

  @ApiProperty({ type: Number, minimum: 0 })
  revision!: number;
}

export class UpdateCatalogMerchandisingDto {
  @ApiProperty({ type: Boolean })
  @Type(() => Object)
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ type: Boolean })
  @Type(() => Object)
  @IsBoolean()
  pinned!: boolean;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100 })
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string | null;

  @ApiProperty({ type: Number, minimum: 0, maximum: 2147483646 })
  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedRevision!: number;
}
