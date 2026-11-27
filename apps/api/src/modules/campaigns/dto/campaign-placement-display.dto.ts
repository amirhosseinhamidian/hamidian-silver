import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CampaignPlacementDisplayDto {
  @IsOptional() @IsBoolean() useTheme?: boolean;
  @IsOptional() @IsString() @Length(1, 64) title?: string;
  @IsOptional() @IsString() @Length(1, 180) message?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-f]{6}$/i) backgroundColor?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-f]{6}$/i) gradientColor?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-f]{6}$/i) borderColor?: string;

  @ApiPropertyOptional({ enum: ['STAR', 'TAG'] })
  @IsOptional()
  @IsIn(['STAR', 'TAG'])
  icon?: 'STAR' | 'TAG';

  @ApiPropertyOptional({ enum: ['NONE', 'SUBTLE', 'EMPHASIS'] })
  @IsOptional()
  @IsIn(['NONE', 'SUBTLE', 'EMPHASIS'])
  motion?: 'NONE' | 'SUBTLE' | 'EMPHASIS';

  @ApiPropertyOptional({ enum: ['COVER', 'CONTAIN'] })
  @IsOptional()
  @IsIn(['COVER', 'CONTAIN'])
  mediaFit?: 'COVER' | 'CONTAIN';

  @ApiPropertyOptional({ enum: ['NONE', 'SOFT', 'STRONG'] })
  @IsOptional()
  @IsIn(['NONE', 'SOFT', 'STRONG'])
  overlay?: 'NONE' | 'SOFT' | 'STRONG';

  @ApiPropertyOptional({ enum: ['LINK', 'SOLID', 'OUTLINE'] })
  @IsOptional()
  @IsIn(['LINK', 'SOLID', 'OUTLINE'])
  ctaStyle?: 'LINK' | 'SOLID' | 'OUTLINE';

  @IsOptional() @IsString() @Length(1, 220) ctaPath?: string;
  @IsOptional() @IsString() @Length(1, 64) ctaLabel?: string;
  @IsOptional() @IsBoolean() showCountdown?: boolean;
}
