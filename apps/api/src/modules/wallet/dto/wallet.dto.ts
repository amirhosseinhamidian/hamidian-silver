import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';
import { WalletBucket, WalletOperationKind, WalletSource } from '../../../generated/prisma/enums';

export class WalletCustomerSearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  q!: string;
}

export class WalletCustomerOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
  @ApiProperty() phone!: string;
}

export class WalletSourceBalanceDto {
  @ApiProperty({ enum: WalletSource })
  source!: WalletSource;
  availableToman!: number;
  pendingToman!: number;
  reservedToman!: number;
  expiredToman!: number;
}

export class WalletBalanceDto {
  pendingToman!: number;
  availableToman!: number;
  reservedToman!: number;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  nextExpiryAt!: string | null;

  @ApiPropertyOptional({ type: Number })
  nextExpiryToman?: number;

  @ApiPropertyOptional({ type: () => WalletSourceBalanceDto, isArray: true })
  sourceBalances?: WalletSourceBalanceDto[];
}

export class WalletLedgerQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;
}

export class WalletMovementDto {
  @ApiProperty({ format: 'uuid' })
  lotId!: string;

  @ApiProperty({ format: 'uuid' })
  originOrderId!: string;

  @ApiProperty({ enum: WalletSource })
  source!: WalletSource;

  sourceKey!: string;

  policyVersion!: number;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  reservationId!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  reservationOrderId!: string | null;

  amountToman!: number;

  @ApiProperty({ enum: WalletBucket, nullable: true })
  fromBucket!: WalletBucket | null;

  @ApiProperty({ enum: WalletBucket })
  toBucket!: WalletBucket;
}

export class WalletOperationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: WalletOperationKind })
  kind!: WalletOperationKind;

  @ApiProperty({ format: 'date-time' })
  recordedAt!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  actorUserId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: () => WalletMovementDto, isArray: true })
  movements!: WalletMovementDto[];
}

export class WalletLedgerPageDto {
  @ApiProperty({ type: () => WalletOperationDto, isArray: true })
  items!: WalletOperationDto[];
  page!: number;
  hasMore!: boolean;
}

const correctionKinds = ['REVOKE_GRANT', 'REVERSE_CAPTURE'] as const;

export class WalletCorrectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ enum: [...correctionKinds] })
  @IsIn(correctionKinds)
  kind!: (typeof correctionKinds)[number];

  @ApiProperty({
    format: 'uuid',
    description: 'Lot ID for REVOKE_GRANT or reservation ID for REVERSE_CAPTURE.',
  })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: TOMAN_INT_MAX })
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  amountToman!: number;

  @ApiProperty({ minLength: 3, maxLength: 250 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Type(() => Object)
  @IsString()
  @Length(3, 250)
  reason!: string;
}
