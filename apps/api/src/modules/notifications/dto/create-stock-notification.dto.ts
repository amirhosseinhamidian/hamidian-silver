import { IsOptional, IsUUID } from 'class-validator';

export class CreateStockNotificationDto {
  @IsUUID('4')
  productId!: string;

  @IsOptional()
  @IsUUID('4')
  variantId?: string;
}
