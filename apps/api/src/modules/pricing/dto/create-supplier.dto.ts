import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @Length(1, 64)
  code!: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  contactName?: string;

  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
