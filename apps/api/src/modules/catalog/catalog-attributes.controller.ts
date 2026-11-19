import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogAttributesService } from './catalog-attributes.service';
import {
  CatalogAttributeDefinitionDto,
  CatalogProductAttributeDto,
  CreateCatalogAttributeDto,
  SetCatalogProductAttributeDto,
  UpdateCatalogAttributeDto,
} from './dto/catalog-attribute.dto';

@Controller('catalog')
export class CatalogAttributesController {
  constructor(private readonly attributes: CatalogAttributesService) {}

  @Get('attribute-definitions')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOkResponse({ type: CatalogAttributeDefinitionDto, isArray: true })
  listDefinitions() {
    return this.attributes.listDefinitions();
  }

  @Post('attribute-definitions')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiCreatedResponse({ type: CatalogAttributeDefinitionDto })
  createDefinition(@Body() dto: CreateCatalogAttributeDto) {
    return this.attributes.createDefinition(dto);
  }

  @Patch('attribute-definitions/:code')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOkResponse({ type: CatalogAttributeDefinitionDto })
  updateDefinition(@Param('code') code: string, @Body() dto: UpdateCatalogAttributeDto) {
    return this.attributes.updateDefinition(code, dto);
  }

  @Get('products/:productId/typed-attributes')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOkResponse({ type: CatalogProductAttributeDto, isArray: true })
  listProductValues(@Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string) {
    return this.attributes.listProductValues(productId);
  }

  @Patch('products/:productId/typed-attributes/:code')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOkResponse({ type: CatalogProductAttributeDto })
  setProductValue(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('code') code: string,
    @Body() dto: SetCatalogProductAttributeDto,
  ) {
    return this.attributes.setProductValue(productId, code, dto);
  }
}
