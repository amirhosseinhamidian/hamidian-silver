import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ReferralPageQueryDto } from './dto/referral.dto';
import {
  PublishReferralRiskPolicyDto,
  ReferralRiskCaseDto,
  ReferralRiskPolicyOverviewDto,
  ReferralRiskPolicyRecordDto,
  ReferralRiskPreviewDto,
  ReferralRiskQueueDto,
  ReferralRiskQueueQueryDto,
  ReviewReferralRiskDto,
  SimulateReferralRiskDto,
} from './dto/referral-risk.dto';
import { ReferralRiskPoliciesService } from './referral-risk-policies.service';
import { ReferralRiskService } from './referral-risk.service';

@Controller({ path: 'referral-risk', version: '1' })
export class ReferralRiskController {
  constructor(
    private readonly policies: ReferralRiskPoliciesService,
    private readonly risk: ReferralRiskService,
  ) {}

  @Get('policies')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralRiskPolicyOverviewDto })
  policiesPage(@Query() query: ReferralPageQueryDto) {
    return this.policies.history(query.page ?? 1);
  }

  @Post('policies')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: ReferralRiskPolicyRecordDto })
  publish(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body() input: PublishReferralRiskPolicyDto,
  ) {
    return this.policies.publish(input, actor.userId);
  }

  @Post('simulation')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralRiskPreviewDto })
  simulate(@Body() input: SimulateReferralRiskDto) {
    return this.policies.simulate(input);
  }

  @Get('cases')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralRiskQueueDto })
  queue(@Query() query: ReferralRiskQueueQueryDto) {
    return this.risk.queue(query.page ?? 1, query.queue ?? 'open');
  }

  @Get('cases/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralRiskCaseDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.risk.read(id);
  }

  @Post('cases/:id/decisions')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: ReferralRiskCaseDto })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body() input: ReviewReferralRiskDto,
  ) {
    return this.risk.review(id, input, actor.userId);
  }
}
