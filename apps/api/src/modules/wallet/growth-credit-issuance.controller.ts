import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { Integer } from '../reward-policies/dto/reward-policy.dto';
import {
  GrowthCreditIssuanceService,
  growthCreditModes,
  type GrowthCreditMode,
} from './growth-credit-issuance.service';

class GrowthCreditModeDto {
  @ApiProperty({ enum: [...growthCreditModes] })
  mode!: GrowthCreditMode;

  @ApiProperty({ format: 'date-time' })
  changedAt!: string;

  version!: number;
}

class GrowthCreditRolloutStatusDto extends GrowthCreditModeDto {
  campaignPromotionsEnabled!: boolean;
  walletCheckoutEnabled!: boolean;
  referralsEnabled!: boolean;
  walletActivationSmsEnabled!: boolean;
  purchaseRewardWorkerEnabled!: boolean;
  referralGrantWorkerEnabled!: boolean;
  referralRiskWorkerEnabled!: boolean;
  walletMaintenanceEnabled!: boolean;
}

class UpdateGrowthCreditModeDto {
  @ApiProperty({ enum: [...growthCreditModes] })
  @IsIn(growthCreditModes)
  mode!: GrowthCreditMode;

  @Integer(1)
  expectedVersion!: number;
}

@Controller({ path: 'wallet/admin/credit-issuance', version: '1' })
export class GrowthCreditIssuanceController {
  constructor(private readonly issuance: GrowthCreditIssuanceService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: GrowthCreditRolloutStatusDto })
  status() {
    return this.issuance.status();
  }

  @Patch()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiOkResponse({ type: GrowthCreditModeDto })
  update(@Body() input: UpdateGrowthCreditModeDto) {
    return this.issuance.setMode(input.mode, input.expectedVersion);
  }
}
