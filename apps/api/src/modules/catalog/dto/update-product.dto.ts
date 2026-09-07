import {
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 220)
  slug?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsUUID('4')
  countryId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPriceToman?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}
