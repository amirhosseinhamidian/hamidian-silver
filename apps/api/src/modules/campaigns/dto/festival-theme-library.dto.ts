import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FestivalThemeDto,
  FestivalThemePresetDto,
  FestivalThemeSourceDto,
} from './festival-design.dto';

export class FestivalThemeLibraryPageDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class FestivalThemeLibraryQueryDto extends FestivalThemeLibraryPageDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class FestivalThemeHistoryQueryDto extends FestivalThemeLibraryPageDto {
  @IsString() @Length(1, 80) name!: string;
}

export class SaveFestivalThemeDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string | null;

  @ApiProperty({ type: () => FestivalThemeDto })
  @IsObject()
  @ValidateNested()
  @Type(() => FestivalThemeDto)
  theme!: FestivalThemeDto;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2_147_483_646 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_646)
  expectedVersion?: number;
}

export class ArchiveFestivalThemeDto {
  @IsString() @Length(1, 80) name!: string;
  @IsInt() @Min(1) @Max(2_147_483_647) expectedVersion!: number;
}

export class FestivalLibraryThemeDto extends FestivalThemePresetDto {
  version!: number;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;
}

export class FestivalLibraryVersionDto extends FestivalThemeSourceDto {
  @ApiProperty({ type: () => FestivalThemeDto })
  theme!: FestivalThemeDto;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class FestivalThemeLibraryListDto {
  @ApiProperty({ type: () => FestivalThemePresetDto, isArray: true })
  presets!: FestivalThemePresetDto[];

  @ApiProperty({ type: () => FestivalLibraryThemeDto, isArray: true })
  items!: FestivalLibraryThemeDto[];

  page!: number;
  hasMore!: boolean;
}

export class FestivalThemeLibraryHistoryDto {
  @ApiProperty({ type: () => FestivalLibraryThemeDto })
  template!: FestivalLibraryThemeDto;

  @ApiProperty({ type: () => FestivalLibraryVersionDto, isArray: true })
  items!: FestivalLibraryVersionDto[];

  page!: number;
  hasMore!: boolean;
}
