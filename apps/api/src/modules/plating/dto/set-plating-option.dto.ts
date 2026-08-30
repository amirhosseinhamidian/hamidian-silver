import { IsBoolean, IsOptional } from 'class-validator';

export class SetPlatingOptionDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
