import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ReferralGrantQueryDto, ReferralGrantReportDto } from './dto/referral-grant.dto';
import { ReferralGrantReportService } from './referral-grant-report.service';

@Controller({ path: 'referral-grants', version: '1' })
export class ReferralGrantController {
  constructor(private readonly grants: ReferralGrantReportService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: ReferralGrantReportDto })
  report(@Query() query: ReferralGrantQueryDto) {
    return this.grants.report(query);
  }
}
