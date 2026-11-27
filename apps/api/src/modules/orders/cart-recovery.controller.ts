import { Body, Controller, Get, Header, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { CartRecoveryService } from './cart-recovery.service';
import {
  SaveCartDto,
  RestoreCartDto,
  SavedCartPolicyDto,
  SavedCartReportDto,
  SavedCartReviewDto,
  SavedCartStatusDto,
  SavedCartVersionDto,
} from './dto/cart-recovery.dto';

@Controller('cart-recovery')
export class CartRecoveryController {
  constructor(private readonly recovery: CartRecoveryService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SavedCartStatusDto })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.recovery.status(principal.userId);
  }

  @Put()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: SavedCartStatusDto })
  save(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: SaveCartDto) {
    return this.recovery.save(principal.userId, body);
  }

  @Post('preview')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: SavedCartReviewDto })
  preview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SavedCartVersionDto,
  ) {
    return this.recovery.review(principal.userId, body);
  }

  @Post('restore')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: SavedCartReviewDto })
  restore(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: RestoreCartDto) {
    return this.recovery.review(principal.userId, body, body.reviewKey);
  }

  @Post('hide')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: SavedCartStatusDto })
  hide(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: SavedCartVersionDto) {
    return this.recovery.dismiss(principal.userId, body, false);
  }

  @Post('discard')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(200)
  @ApiOkResponse({ type: SavedCartStatusDto })
  discard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SavedCartVersionDto,
  ) {
    return this.recovery.dismiss(principal.userId, body, true);
  }

  @Get('admin/report')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: SavedCartReportDto })
  report() {
    return this.recovery.report();
  }

  @Patch('admin/policy')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_WRITE)
  @ApiOkResponse({ type: SavedCartPolicyDto })
  policy(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() body: SavedCartPolicyDto) {
    return this.recovery.updatePolicy(body, principal.userId);
  }
}
