import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSizeDto {
  @IsString()
  @Length(1, 50)
  code!: string;

  @IsString()
  @Length(1, 100)
  label!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
