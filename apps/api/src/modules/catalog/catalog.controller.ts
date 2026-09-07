import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { MEDIA_UPLOAD_LIMIT_BYTES } from '../../config/media-storage';
import { Public } from '../auth/public.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { CatalogMediaService } from './catalog-media.service';
import { CatalogCategoriesService } from './catalog-categories.service';
import { CatalogService } from './catalog.service';
import { CatalogVariantsService } from './catalog-variants.service';
import { AdminCatalogProductsQueryDto } from './dto/admin-catalog-products-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateProductDto, CreateProductVariantDto } from './dto/create-product.dto';
import { CreateSizeDto } from './dto/create-size.dto';
import { PublicCatalogQueryDto } from './dto/public-catalog-query.dto';
import { ReorderProductMediaDto } from './dto/reorder-product-media.dto';
import {
  PublicCatalogBrandDto,
  PublicCatalogCategoryDto,
  PublicCatalogProductDetailDto,
  PublicCatalogProductListDto,
} from './dto/public-catalog-response.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductMediaDto } from './dto/update-product-media.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import type { CatalogUploadFile } from './local-media-storage.service';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogCategoriesService: CatalogCategoriesService,
    private readonly catalogMediaService: CatalogMediaService,
    private readonly catalogVariantsService: CatalogVariantsService,
  ) {}

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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MEDIA_UPLOAD_LIMIT_BYTES,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        altText: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
        },
      },
    },
  })
  uploadMedia(@UploadedFile() file: CatalogUploadFile | undefined, @Body() dto: UploadMediaDto) {
    return this.catalogMediaService.upload(file, dto);
  }

  @Post('categories')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogCategoriesService.create(dto);
  }

  @Post('categories/:categoryId/image')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', minLength: 1, maxLength: 255 },
      },
    },
  })
  uploadCategoryImage(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @UploadedFile() file: CatalogUploadFile | undefined,
    @Body() dto: UploadMediaDto,
  ) {
    return this.catalogMediaService.uploadForCategory(categoryId, file, dto);
  }

  @Delete('categories/:categoryId/image')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  removeCategoryImage(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
  ) {
    return this.catalogMediaService.removeCategoryImage(categoryId);
  }

  @Get('categories')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listCategories() {
    return this.catalogCategoriesService.list();
  }

  @Patch('categories/:categoryId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateCategory(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogCategoriesService.update(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  archiveCategory(@Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string) {
    return this.catalogCategoriesService.archive(categoryId);
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
    return this.catalogVariantsService.createSize(dto);
  }

  @Get('sizes')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listSizes() {
    return this.catalogVariantsService.listSizes();
  }

  @Patch('sizes/:sizeId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateSize(
    @Param('sizeId', new ParseUUIDPipe({ version: '4' })) sizeId: string,
    @Body() dto: UpdateSizeDto,
  ) {
    return this.catalogVariantsService.updateSize(sizeId, dto);
  }

  @Post('products')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @Post('products/:productId/media')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MEDIA_UPLOAD_LIMIT_BYTES,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', minLength: 1, maxLength: 255 },
      },
    },
  })
  uploadProductMedia(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @UploadedFile() file: CatalogUploadFile | undefined,
    @Body() dto: UploadMediaDto,
  ) {
    return this.catalogMediaService.uploadForProduct(productId, file, dto);
  }

  @Get('products')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listProducts(@Query() query: AdminCatalogProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @Get('products/:productId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  getProduct(@Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string) {
    return this.catalogService.getProduct(productId);
  }

  @Post('products/:productId/variants')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  createProductVariant(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.catalogVariantsService.createVariant(productId, dto);
  }

  @Patch('products/:productId/variants/:variantId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateProductVariant(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.catalogVariantsService.updateVariant(productId, variantId, dto);
  }

  @Patch('products/:productId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateProduct(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(productId, dto);
  }

  @Patch('products/:productId/status')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateProductStatus(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.catalogService.updateProductStatus(productId, dto.status);
  }

  @Patch('products/:productId/media/order')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  reorderProductMedia(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: ReorderProductMediaDto,
  ) {
    return this.catalogMediaService.reorderProductMedia(productId, dto.mediaIds);
  }

  @Patch('products/:productId/media/:mediaId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateProductMedia(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
    @Body() dto: UpdateProductMediaDto,
  ) {
    return this.catalogMediaService.updateProductMedia(productId, mediaId, dto);
  }

  @Delete('products/:productId/media/:mediaId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  removeProductMedia(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
  ) {
    return this.catalogMediaService.removeProductMedia(productId, mediaId);
  }
}
