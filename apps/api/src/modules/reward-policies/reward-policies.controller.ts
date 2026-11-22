import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  ActiveRewardPolicyDto,
  CreateRewardPolicyDto,
  RewardPolicyDetailDto,
  RewardPolicyListDto,
  RewardPolicyPageQueryDto,
  RewardPolicySimulationRequestDto,
  RewardPolicyVersionParamDto,
  RewardSimulationDto,
} from './dto/reward-policy.dto';
import { RewardPoliciesService } from './reward-policies.service';

@Controller({ path: 'reward-policies', version: '1' })
export class RewardPoliciesController {
  constructor(private readonly policies: RewardPoliciesService) {}

  @Get()
  @ApiOkResponse({ type: RewardPolicyListDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  list(@Query() query: RewardPolicyPageQueryDto) {
    return this.policies.list(query.page ?? 1);
  }

  @Get('active')
  @ApiOkResponse({ type: ActiveRewardPolicyDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  active() {
    return this.policies.active();
  }

  @Get(':version')
  @ApiOkResponse({ type: RewardPolicyDetailDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  read(@Param() path: RewardPolicyVersionParamDto) {
    return this.policies.read(path.version);
  }

  @Post()
  @ApiCreatedResponse({ type: RewardPolicyDetailDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  create(@Body() input: CreateRewardPolicyDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) {
    return this.policies.createDraft(input, actor.userId);
  }

  @Post('simulation')
  @HttpCode(200)
  @ApiOkResponse({ type: RewardSimulationDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  simulate(@Body() input: RewardPolicySimulationRequestDto) {
    return this.policies.simulate(input.version, input);
  }

  @Post(':version/publish')
  @HttpCode(200)
  @ApiOkResponse({ type: RewardPolicyDetailDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  publish(
    @Param() path: RewardPolicyVersionParamDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    return this.policies.publish(path.version, actor.userId);
  }
}
