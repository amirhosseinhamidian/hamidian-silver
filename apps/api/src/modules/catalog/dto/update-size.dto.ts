import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class UpdateSizeDto {
  @IsOptional()
  @IsUUID('4')
  groupId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
