import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpdateContentPageSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string | null;
}

export class UpdateContentPageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  eyebrow?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  body?: string | null;

  @IsOptional()
  @IsUUID('4')
  heroMediaId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => UpdateContentPageSectionDto)
  sections!: UpdateContentPageSectionDto[];
}
