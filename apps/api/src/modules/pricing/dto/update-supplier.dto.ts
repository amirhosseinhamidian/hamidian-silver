import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @Length(5, 20)
  @Matches(/^\+?\d{5,20}$/)
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
