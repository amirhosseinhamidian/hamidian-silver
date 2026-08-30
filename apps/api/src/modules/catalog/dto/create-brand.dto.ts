import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBrandDto {
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
  @IsUUID('4')
  imageId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
