import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsString, Length } from 'class-validator';
import { PurchaseRewardJobStatus } from '../../generated/prisma/enums';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { PurchaseRewardWorker } from './purchase-reward.worker';
import { WalletLedgerQueryDto } from './dto/wallet.dto';

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

class CustomerRewardJobDto extends DeadLetterPurchaseRewardJobDto {
  @ApiProperty({ enum: PurchaseRewardJobStatus })
  status!: PurchaseRewardJobStatus;
  orderNumber!: string;
  @ApiProperty({ format: 'date-time' })
  nextAttemptAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  reviewHeldAt!: string | null;
}

class CustomerRewardJobsPageDto {
  @ApiProperty({ type: () => [CustomerRewardJobDto] })
  items!: CustomerRewardJobDto[];
  page!: number;
  hasMore!: boolean;
}

class RewardReviewHoldDto {
  @Type(() => Object)
  @IsBoolean()
  hold!: boolean;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Type(() => Object)
  @IsString()
  @Length(3, 250)
  reason!: string;
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

  @Get('customers/:userId')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ)
  @ApiOkResponse({ type: CustomerRewardJobsPageDto })
  customerJobs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: WalletLedgerQueryDto,
  ) {
    return this.worker.forCustomer(userId, query.page ?? 1);
  }

  @Patch(':orderId/review-hold')
  @RequirePermissions(PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE)
  @ApiOkResponse({ type: RetriedPurchaseRewardJobDto })
  async reviewHold(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: RewardReviewHoldDto,
  ) {
    await this.worker.setReviewHold(orderId, body.hold);
    return attachHumanAuditEvent(
      { orderId },
      {
        title: body.hold ? 'قفل بررسی پاداش ثبت شد.' : 'قفل بررسی پاداش برداشته شد.',
        operationType: 'UPDATE',
        entityName: orderId,
        changes: [
          { field: 'reviewHold', label: 'قفل بررسی', before: !body.hold, after: body.hold },
          { field: 'reason', label: 'دلیل بررسی', before: null, after: body.reason },
        ],
      },
    );
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
