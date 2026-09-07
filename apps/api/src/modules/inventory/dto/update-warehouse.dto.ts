import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
