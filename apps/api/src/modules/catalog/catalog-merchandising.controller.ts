import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogMerchandisingService } from './catalog-merchandising.service';
import {
  CatalogMerchandisingDto,
  UpdateCatalogMerchandisingDto,
} from './dto/catalog-merchandising.dto';

@Controller('catalog/products/:productId/merchandising')
export class CatalogMerchandisingController {
  constructor(private readonly merchandising: CatalogMerchandisingService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOkResponse({ type: CatalogMerchandisingDto })
  read(@Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string) {
    return this.merchandising.read(productId);
  }

  @Patch()
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOkResponse({ type: CatalogMerchandisingDto })
  update(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() input: UpdateCatalogMerchandisingDto,
  ) {
    return this.merchandising.update(productId, input);
  }
}
