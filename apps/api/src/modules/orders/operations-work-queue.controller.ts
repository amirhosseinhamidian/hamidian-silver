import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { OperationsWorkQueueQueryDto } from './dto/operations-work-queue-query.dto';
import { OperationsWorkQueueService } from './operations-work-queue.service';

@Controller('operations/work-queue')
export class OperationsWorkQueueController {
  constructor(private readonly operationsWorkQueueService: OperationsWorkQueueService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  list(@Query() query: OperationsWorkQueueQueryDto) {
    return this.operationsWorkQueueService.list(query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  summary() {
    return this.operationsWorkQueueService.summary();
  }
}
