import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import { PlatingType } from '../../generated/prisma/enums';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { SetPlatingEligibilityDto } from './dto/set-plating-eligibility.dto';
import { SetPlatingOptionDto } from './dto/set-plating-option.dto';
import { SetPlatingRateDto } from './dto/set-plating-rate.dto';
import { PlatingService } from './plating.service';

@Controller('plating')
export class PlatingController {
  constructor(private readonly platingService: PlatingService) {}

  @Get('rates')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  listRates() {
    return this.platingService.listRates();
  }

  @Put('rates/:type')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  setRate(
    @Param('type', new ParseEnumPipe(PlatingType)) type: PlatingType,
    @Body() dto: SetPlatingRateDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.platingService.setRate(type, dto, principal.userId);
  }

  @Get('rates/:type/history')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  listRateHistory(@Param('type', new ParseEnumPipe(PlatingType)) type: PlatingType) {
    return this.platingService.listRateHistory(type);
  }

  @Patch('variants/:variantId/eligibility')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  setVariantEligibility(
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: SetPlatingEligibilityDto,
  ) {
    return this.platingService.setVariantEligibility(variantId, dto);
  }

  @Put('variants/:variantId/options/:type')
  @RequirePermissions(PERMISSION_CODES.PRICING_WRITE)
  setVariantOption(
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Param('type', new ParseEnumPipe(PlatingType)) type: PlatingType,
    @Body() dto: SetPlatingOptionDto,
  ) {
    return this.platingService.setVariantOption(variantId, type, dto);
  }

  @Get('variants/:variantId')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  getVariantPlating(@Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string) {
    return this.platingService.getVariantPlating(variantId);
  }

  @Get('variants/:variantId/quote/:type')
  @RequirePermissions(PERMISSION_CODES.PRICING_READ)
  quoteVariant(
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Param('type', new ParseEnumPipe(PlatingType)) type: PlatingType,
  ) {
    return this.platingService.quoteVariant(variantId, type);
  }
}
