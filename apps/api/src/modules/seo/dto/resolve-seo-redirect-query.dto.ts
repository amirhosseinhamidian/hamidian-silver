import { IsString, Matches, MaxLength } from 'class-validator';

export class ResolveSeoRedirectQueryDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/^\/(?:products|categories|brands)\/[^/?#\s]+$/)
  path!: string;
}
