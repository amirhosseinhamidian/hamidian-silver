import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ReferralPageQueryDto } from './dto/referral.dto';
import {
  CreateReferralRewardDraftDto,
  ReferralPolicyDetailDto,
  ReferralPolicyListDto,
  ReferralPolicyVersionParamDto,
  ReferralRewardPreviewDto,
  ReferralScopeDto,
  ReferralScopeQueryDto,
  SimulateReferralRewardPolicyDto,
} from './dto/referral-reward-policy.dto';
import { ReferralRewardPoliciesService } from './referral-reward-policies.service';

@Controller({ path: 'referral-reward-policies', version: '1' })
export class ReferralRewardPoliciesController {
  constructor(private readonly policies: ReferralRewardPoliciesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralPolicyListDto })
  list(@Query() query: ReferralPageQueryDto) {
    return this.policies.list(query.page ?? 1);
  }

  @Get('scopes')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralScopeDto, isArray: true })
  scopes(@Query() query: ReferralScopeQueryDto) {
    return this.policies.scopes(query);
  }

  @Get(':version')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralPolicyDetailDto })
  read(@Param() params: ReferralPolicyVersionParamDto) {
    return this.policies.read(params.version);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: ReferralPolicyDetailDto })
  create(
    @Body() input: CreateReferralRewardDraftDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.policies.createDraft(input, actor.userId);
  }

  @Post('simulation')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralRewardPreviewDto })
  simulate(@Body() input: SimulateReferralRewardPolicyDto) {
    return this.policies.simulate(input);
  }

  @Post(':version/publish')
  @HttpCode(200)
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiOkResponse({ type: ReferralPolicyDetailDto })
  publish(
    @Param() params: ReferralPolicyVersionParamDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.policies.publish(params.version, actor.userId);
  }
}
