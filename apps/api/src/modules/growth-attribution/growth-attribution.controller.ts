import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CampaignLinksService } from './campaign-links.service';
import { CampaignLinkDto, CreateCampaignLinkDto } from './dto/attribution.dto';

@Controller('growth-attribution')
export class GrowthAttributionController {
  constructor(private readonly links: CampaignLinksService) {}

  @Post('campaign-links')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiCreatedResponse({ type: CampaignLinkDto })
  @ApiConflictResponse({ description: 'Tracking parameters or a campaign identity conflict.' })
  @ApiBadRequestResponse({ description: 'Invalid destination or campaign labels.' })
  createCampaignLink(@Body() input: CreateCampaignLinkDto) {
    return this.links.create(input);
  }
}
