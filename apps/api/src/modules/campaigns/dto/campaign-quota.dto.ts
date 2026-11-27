import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CampaignQuotaProductDto {
  @ApiProperty({ maxLength: 220 })
  @IsString()
  @Length(1, 220)
  slug!: string;
}

export class SaveCampaignQuotaDto extends CampaignQuotaProductDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2_147_483_647 })
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  limit!: number;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: 2_147_483_647 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  manualSold!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class PublicCampaignQuotaDto {
  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ type: 'integer' })
  limit!: number;

  @ApiProperty({ type: 'integer' })
  sold!: number;

  @ApiProperty({ type: 'integer' })
  remaining!: number;
}

export class CampaignQuotaAdminDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'integer' })
  limit!: number;

  @ApiProperty({ type: 'integer' })
  manualSold!: number;

  @ApiProperty({ type: 'integer' })
  revision!: number;

  @ApiProperty({ type: 'integer' })
  siteSold!: number;

  @ApiProperty({ type: 'integer' })
  reserved!: number;

  @ApiProperty({ type: 'integer' })
  remaining!: number;

  @ApiProperty({ type: 'integer' })
  sellableStock!: number;
}
