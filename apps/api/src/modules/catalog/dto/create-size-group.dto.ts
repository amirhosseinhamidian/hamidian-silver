import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSizeGroupDto {
  @IsString()
  @Length(1, 50)
  code!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(1, 100)
  selectionLabel!: string;

  @IsString()
  @Length(1, 50)
  cartLabel!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
