import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { BackfillFinanceSnapshotsDto } from './dto/backfill-finance-snapshots.dto';
import { FinancePeriodQueryDto } from './dto/finance-period-query.dto';
import { ListFinanceOrdersQueryDto } from './dto/list-finance-orders-query.dto';
import { OrderFinanceService } from './order-finance.service';

@Controller('finance')
export class OrderFinanceController {
  constructor(private readonly orderFinanceService: OrderFinanceService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  dashboard(@Query() query: FinancePeriodQueryDto) {
    return this.orderFinanceService.dashboard(query);
  }

  @Get('orders')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  listOrders(@Query() query: ListFinanceOrdersQueryDto) {
    return this.orderFinanceService.listOrders(query);
  }

  @Post('orders/backfill-missing')
  @RequirePermissions(PERMISSION_CODES.FINANCE_WRITE)
  backfillMissing(@Body() dto: BackfillFinanceSnapshotsDto) {
    return this.orderFinanceService.backfillMissing(dto);
  }

  @Get('orders/:orderId')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  getOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return this.orderFinanceService.getOrder(orderId);
  }
}
