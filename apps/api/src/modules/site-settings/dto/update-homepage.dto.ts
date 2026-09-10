import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateHomepageHeroSlideDto {
  @IsUUID('4')
  mediaId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  actionLabel?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  actionHref?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateHomepageDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UpdateHomepageHeroSlideDto)
  primaryHeroSlides!: UpdateHomepageHeroSlideDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHomepageHeroSlideDto)
  secondaryHero?: UpdateHomepageHeroSlideDto | null;

  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  popularProductIds!: string[];

  @IsBoolean()
  manufacturerCountriesEnabled!: boolean;

  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  manufacturerCountryIds!: string[];
}

export class HomepagePriorityDto {
  @IsUUID('4')
  id!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  priority!: number;
}
