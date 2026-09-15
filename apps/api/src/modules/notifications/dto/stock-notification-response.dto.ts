import { ApiProperty } from '@nestjs/swagger';

export class StockNotificationResponseDto {
  subscribed!: boolean;

  @ApiProperty({ enum: ['PRODUCT', 'VARIANT'] })
  target!: 'PRODUCT' | 'VARIANT';
}
