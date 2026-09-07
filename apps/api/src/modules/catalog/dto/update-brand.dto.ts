import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  imageId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
