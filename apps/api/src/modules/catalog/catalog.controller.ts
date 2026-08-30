import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogService } from './catalog.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateMediaDto } from './dto/create-media.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

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
