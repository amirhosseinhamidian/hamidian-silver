import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AttributionTouchDto {
  source!: string;
  medium!: string;
  campaign?: string;
  content?: string;
  campaignId?: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;
}

export class SessionAttributionDto {
  @ApiProperty({ enum: [1] })
  version!: 1;

  @ApiProperty({ type: () => AttributionTouchDto, isArray: true, maxItems: 32 })
  touches!: AttributionTouchDto[];
}

export class CreateCampaignLinkDto {
  @Type(() => Object)
  @IsString()
  @Length(1, 1000)
  destination!: string;

  @Type(() => Object)
  @IsString()
  @Length(1, 96)
  campaign!: string;

  @Type(() => Object)
  @IsString()
  @Length(1, 64)
  campaignId!: string;

  @Type(() => Object)
  @IsString()
  @Length(1, 96)
  source!: string;

  @Type(() => Object)
  @IsString()
  @Length(1, 96)
  medium!: string;

  @ApiPropertyOptional({ maxLength: 96 })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @MaxLength(96)
  content?: string;
}

export class CampaignLinkDto {
  @ApiProperty({ format: 'uri' })
  url!: string;
  campaignId!: string;
  campaign!: string;
}
