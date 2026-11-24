import { Body, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import {
  IssuedReferralCodeDto,
  ReceivedReferralDto,
  ReferralClaimDto,
  ReferralOverviewDto,
  ReferralPageQueryDto,
} from './dto/referral.dto';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ReferralOverviewDto })
  overview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ReferralPageQueryDto,
  ) {
    return this.referrals.overview(principal.userId, query.page ?? 1);
  }

  @Post('code')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: IssuedReferralCodeDto })
  issueCode(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.referrals.issueCode(principal.userId);
  }

  @Post('claim')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: ReceivedReferralDto })
  claim(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() input: ReferralClaimDto) {
    return this.referrals.claim(principal.userId, input.code);
  }
}
