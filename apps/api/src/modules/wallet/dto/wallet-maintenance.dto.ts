import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  WalletReconciliationCode,
  WalletReconciliationSubject,
} from '../../../generated/prisma/enums';
import { WalletLedgerQueryDto } from './wallet.dto';

export class WalletMaintenanceQueryDto extends WalletLedgerQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'resolved'] })
  @IsOptional()
  @IsIn(['open', 'resolved'])
  status?: 'open' | 'resolved';
}

class WalletCommitmentTotalsDto {
  availableToman!: number;
  pendingToman!: number;
  reservedToman!: number;
  expiredToman!: number;
  capturedToman!: number;
  revokedToman!: number;
  awaitingExpiryToman!: number;
}

class WalletReconciliationIssueDto {
  @ApiProperty({ enum: WalletReconciliationSubject })
  subject!: WalletReconciliationSubject;

  @ApiProperty({ format: 'uuid' })
  subjectId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ type: String, nullable: true })
  orderNumber!: string | null;

  @ApiProperty({ enum: WalletReconciliationCode })
  code!: WalletReconciliationCode;

  @ApiProperty({ format: 'date-time' })
  detectedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
}

export class WalletMaintenanceReportDto {
  @ApiProperty({ format: 'date-time' })
  asOf!: string;

  enabled!: boolean;

  @ApiProperty({ type: () => WalletCommitmentTotalsDto })
  totals!: WalletCommitmentTotalsDto;

  @ApiProperty({ type: () => [WalletReconciliationIssueDto] })
  issues!: WalletReconciliationIssueDto[];

  page!: number;
  hasMore!: boolean;
}
