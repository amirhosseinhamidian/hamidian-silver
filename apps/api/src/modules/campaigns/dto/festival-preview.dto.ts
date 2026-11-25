import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { CampaignLandingDraftDto } from './campaign-landing.dto';
import { FestivalDesignDto } from './festival-design.dto';

export class FestivalPreviewDraftDto extends FestivalDesignDto {
  @ApiPropertyOptional({ type: () => CampaignLandingDraftDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CampaignLandingDraftDto)
  landing?: CampaignLandingDraftDto;
}
