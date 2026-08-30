import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @Length(1, 64)
  code!: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
