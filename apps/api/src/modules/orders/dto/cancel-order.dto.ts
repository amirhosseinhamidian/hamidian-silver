import { IsOptional, IsString, Length } from 'class-validator';

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
