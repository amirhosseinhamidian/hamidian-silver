import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  PolicyBasketResultDto,
  PolicyBasketScenarioDto,
  PolicyHistoryResultDto,
  PolicyHistoryScenarioDto,
  PolicyReviewListDto,
} from './dto/policy-simulation.dto';
import { RewardPolicyPageQueryDto } from './dto/reward-policy.dto';
import { PolicySimulationService } from './policy-simulation.service';

@Controller({ path: 'reward-policies/policy-simulator', version: '1' })
export class PolicySimulationController {
  constructor(private readonly simulations: PolicySimulationService) {}

  @Post('basket')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PolicyBasketResultDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  basket(
    @Body() input: PolicyBasketScenarioDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    this.requireReviewPermission(input, actor);
    return this.simulations.basket(input, actor.userId);
  }

  @Post('history')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PolicyHistoryResultDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  history(
    @Body() input: PolicyHistoryScenarioDto,
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
  ) {
    this.requireReviewPermission(input, actor);
    return this.simulations.history(input, actor.userId);
  }

  @Get('reviews')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PolicyReviewListDto })
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  reviews(@Query() query: RewardPolicyPageQueryDto) {
    return this.simulations.list(query.page ?? 1);
  }

  private requireReviewPermission(
    input: PolicyBasketScenarioDto | PolicyHistoryScenarioDto,
    actor: AuthenticatedPrincipal,
  ) {
    if (input.review && !actor.permissionCodes.includes(PERMISSION_CODES.FINANCE_WRITE))
      throw new ForbiddenException('مجوز ثبت تصمیم شبیه‌سازی لازم است.');
  }
}
