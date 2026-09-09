import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 180)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/^\/(?!\/)[^\s?#]*$/)
  seoCanonicalPath?: string;

  @IsOptional()
  @IsBoolean()
  seoNoIndex?: boolean;

  @IsOptional()
  @IsUUID('4')
  seoOgMediaId?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @IsUUID('4')
  imageId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
