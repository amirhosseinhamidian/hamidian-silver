import { IsOptional, IsString, Length } from 'class-validator';

export class UploadMediaDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  altText?: string;
}
