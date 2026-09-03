import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogService } from './catalog.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import {
  PublicCatalogBrandDto,
  PublicCatalogCategoryDto,
  PublicCatalogProductDetailDto,
  PublicCatalogProductListDto,
} from './dto/public-catalog-response.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('public/categories')
  @ApiOkResponse({ type: PublicCatalogCategoryDto, isArray: true })
  listPublicCategories() {
    return this.catalogService.listPublicCategories();
  }

  @Public()
  @Get('public/brands')
  @ApiOkResponse({ type: PublicCatalogBrandDto, isArray: true })
  listPublicBrands() {
    return this.catalogService.listPublicBrands();
  }

  @Public()
  @Get('public/products')
  @ApiOkResponse({ type: PublicCatalogProductListDto })
  listPublicProducts(@Query() query: PublicCatalogQueryDto) {
    return this.catalogService.listPublicProducts(query);
  }

  @Public()
  @Get('public/products/:slug')
  @ApiOkResponse({ type: PublicCatalogProductDetailDto })
  @ApiNotFoundResponse()
  getPublicProduct(@Param('slug') slug: string) {
    return this.catalogService.getPublicProduct(slug);
  }

  @Post('media')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createMedia(@Body() dto: CreateMediaDto) {
    return this.catalogService.createMedia(dto);
  }

  @Post('categories')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @Get('categories')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Post('brands')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createBrand(@Body() dto: CreateBrandDto) {
    return this.catalogService.createBrand(dto);
  }

  @Get('brands')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listBrands() {
    return this.catalogService.listBrands();
  }

  @Post('countries')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createCountry(@Body() dto: CreateCountryDto) {
    return this.catalogService.createCountry(dto);
  }

  @Get('countries')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listCountries() {
    return this.catalogService.listCountries();
  }

  @Post('sizes')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createSize(@Body() dto: CreateSizeDto) {
    return this.catalogService.createSize(dto);
  }

  @Get('sizes')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listSizes() {
    return this.catalogService.listSizes();
  }

  @Post('products')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @Get('products')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listProducts() {
    return this.catalogService.listProducts();
  }
}
