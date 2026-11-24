import { Body, Controller, Get, Header, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import {
  IssuedReferralCodeDto,
  ReceivedReferralDto,
  ReferralClaimDto,
  ReferralCheckoutAvailabilityDto,
  ReferralOverviewDto,
  ReferralPageQueryDto,
} from './dto/referral.dto';
import { ReferralsService } from './referrals.service';
import { ReferralRiskObservationsService } from './referral-risk-observations.service';

@Controller('referrals')
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly observations: ReferralRiskObservationsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ReferralOverviewDto })
  overview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ReferralPageQueryDto,
  ) {
    return this.referrals.overview(principal.userId, query.page ?? 1);
  }

  @Get('checkout')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ReferralCheckoutAvailabilityDto })
  checkout(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.referrals.checkout(principal.userId);
  }

  @Post('code')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: IssuedReferralCodeDto })
  async issueCode(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('x-referral-risk-context') context: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const result = await this.referrals.issueCode(principal.userId);
    await this.observations.record(principal.userId, context, authorization);
    return result;
  }

  @Post('claim')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ReceivedReferralDto })
  async claim(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() input: ReferralClaimDto,
    @Headers('x-referral-risk-context') context: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const result = await this.referrals.claim(principal.userId, input.code);
    await this.observations.record(principal.userId, context, authorization);
    return result;
  }
}
