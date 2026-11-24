import { Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { PurchaseRewardJobStatus } from '../../generated/prisma/enums';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { PurchaseRewardWorker } from './purchase-reward.worker';

class PurchaseRewardJobCountDto {
  @ApiProperty({ enum: PurchaseRewardJobStatus })
  status!: PurchaseRewardJobStatus;
  @ApiProperty({ type: Number })
  count!: number;
}

class DeadLetterPurchaseRewardJobDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;
  @ApiProperty({ type: Number })
  attempts!: number;
  @ApiProperty({ type: String, nullable: true })
  resultCode!: string | null;
}

class PurchaseRewardMetricsDto {
  @ApiProperty({ type: () => [PurchaseRewardJobCountDto] })
  statuses!: PurchaseRewardJobCountDto[];
  @ApiProperty({ type: Number })
  due!: number;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  oldestDueAt!: string | null;
  @ApiProperty({ type: Boolean })
  enabled!: boolean;
  @ApiProperty({ type: () => [DeadLetterPurchaseRewardJobDto] })
  deadLetters!: DeadLetterPurchaseRewardJobDto[];
}

class RetriedPurchaseRewardJobDto {
  @ApiProperty({ format: 'uuid' })
  orderId!: string;
}

@Controller({ path: 'wallet/admin/purchase-reward-jobs', version: '1' })
export class PurchaseRewardJobsController {
  constructor(private readonly worker: PurchaseRewardWorker) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: PurchaseRewardMetricsDto })
  metrics() {
    return this.worker.metrics();
  }

  @Post(':orderId/retry')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiCreatedResponse({ type: RetriedPurchaseRewardJobDto })
  async retry(@Param('orderId', ParseUUIDPipe) orderId: string) {
    await this.worker.retryDeadLetter(orderId);
    return attachHumanAuditEvent(
      { orderId },
      {
        title: 'تلاش مجدد برای پردازش پاداش خرید ثبت شد.',
        operationType: 'UPDATE',
        entityName: orderId,
        changes: [{ field: 'status', label: 'وضعیت', before: 'DEAD_LETTER', after: 'QUEUED' }],
      },
    );
  }
}
