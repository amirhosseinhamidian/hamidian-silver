import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListFulfillmentReadinessQueryDto } from './dto/list-fulfillment-readiness-query.dto';
import { FulfillmentReadinessService } from './fulfillment-readiness.service';

@Controller('operations/orders')
export class FulfillmentReadinessController {
  constructor(private readonly fulfillmentReadinessService: FulfillmentReadinessService) {}

  @Get('readiness')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  list(@Query() query: ListFulfillmentReadinessQueryDto) {
    return this.fulfillmentReadinessService.list(query);
  }

  @Get(':orderId/readiness')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  get(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return this.fulfillmentReadinessService.get(orderId);
  }
}
