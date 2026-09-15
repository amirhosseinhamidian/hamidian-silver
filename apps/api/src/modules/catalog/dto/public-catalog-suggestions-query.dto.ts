import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class PublicCatalogSuggestionsQueryDto {
  @IsString()
  @Length(2, 100)
  q!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 8, default: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  limit?: number;
}
