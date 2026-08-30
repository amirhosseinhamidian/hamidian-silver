import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateMediaDto {
  @IsString()
  @Length(1, 500)
  storageKey!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  originalName?: string;

  @IsString()
  @Length(1, 100)
  mimeType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  altText?: string;
}
