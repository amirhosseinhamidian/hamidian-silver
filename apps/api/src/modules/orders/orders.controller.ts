import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto, PromotionEstimateRequestDto } from './dto/create-order.dto';
import { CheckoutPriceQuoteDto, PromotionEstimateDto } from '../promotions/dto/promotion.dto';
import { WalletPreviewDto } from '../wallet/dto/customer-wallet.dto';
import {
  CustomerOrderCountDto,
  CustomerOrderDetailDto,
  CustomerOrderSummaryDto,
} from './dto/customer-order-response.dto';
import { AdminListOrdersQueryDto, ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiCreatedResponse({ type: CustomerOrderDetailDto })
  createOrder(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(principal.userId, dto);
  }

  @Post('promotion-estimate')
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PromotionEstimateDto })
  estimate(@Body() dto: PromotionEstimateRequestDto): Promise<PromotionEstimateDto> {
    return this.ordersService.estimatePromotions(dto.items);
  }

  @Post('wallet-estimate')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: WalletPreviewDto })
  estimateWallet(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: PromotionEstimateRequestDto,
  ): Promise<WalletPreviewDto> {
    return this.ordersService.estimateWallet(principal.userId, dto.items);
  }

  @Post('price-quote')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: CheckoutPriceQuoteDto })
  quote(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateOrderDto,
  ): Promise<CheckoutPriceQuoteDto> {
    return this.ordersService.quotePrice(principal.userId, dto);
  }

  @Get('me')
  @ApiOkResponse({ type: CustomerOrderSummaryDto, isArray: true })
  listMyOrders(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.listMyOrders(principal.userId, query);
  }

  @Get('me/count')
  @ApiOkResponse({ type: CustomerOrderCountDto })
  countMyOrders(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.ordersService.countMyOrders(principal.userId);
  }

  @Get('me/:orderId')
  @ApiOkResponse({ type: CustomerOrderDetailDto })
  getMyOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.getMyOrder(principal.userId, orderId);
  }

  @Post('me/:orderId/cancel')
  @ApiOkResponse({ type: CustomerOrderDetailDto })
  cancelMyOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelMyOrder(principal.userId, orderId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  listOrders(@Query() query: AdminListOrdersQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @Patch(':orderId/status')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  updateStatus(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.ordersService.updateStatus(orderId, dto, principal.userId);
  }

  @Post(':orderId/cancel')
  @RequirePermissions(PERMISSION_CODES.ORDERS_CANCEL)
  cancelOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.ordersService.cancelOrder(orderId, dto, principal.userId);
  }
}
