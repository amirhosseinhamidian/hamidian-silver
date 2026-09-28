import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListSupplierImportDraftsQueryDto } from './dto/list-supplier-import-drafts-query.dto';
import { ListSupplierCrawlRunsQueryDto } from './dto/list-supplier-crawl-runs-query.dto';
import { ListSupplierCategoriesQueryDto } from './dto/list-supplier-categories-query.dto';
import { StartBulkSupplierCrawlDto } from './dto/start-bulk-supplier-crawl.dto';
import { StartSupplierCrawlDto } from './dto/start-supplier-crawl.dto';
import { SyncSupplierCategoriesDto } from './dto/sync-supplier-categories.dto';
import { UpdateSupplierImportDraftDto } from './dto/update-supplier-import-draft.dto';
import { SupplierImportsService } from './supplier-imports.service';

@Controller('supplier-imports')
export class SupplierImportsController {
  constructor(private readonly supplierImportsService: SupplierImportsService) {}

  @Get('sources')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listSources() {
    return this.supplierImportsService.listSources();
  }

  @Get('drafts')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listDrafts(@Query() query: ListSupplierImportDraftsQueryDto) {
    return this.supplierImportsService.listDrafts(query);
  }

  @Get('drafts/:draftId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  getDraft(@Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string) {
    return this.supplierImportsService.getDraft(draftId);
  }

  @Get('categories')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listCategories(@Query() query: ListSupplierCategoriesQueryDto) {
    return this.supplierImportsService.listCategories(query);
  }

  @Post('categories/sync')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  syncCategories(@Body() dto: SyncSupplierCategoriesDto) {
    return this.supplierImportsService.syncCategories(dto);
  }

  @Get('runs')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  listRuns(@Query() query: ListSupplierCrawlRunsQueryDto) {
    return this.supplierImportsService.listRuns(query);
  }

  @Post('bulk-crawls')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  startBulkCrawl(@Body() dto: StartBulkSupplierCrawlDto) {
    return this.supplierImportsService.startBulkCrawl(dto);
  }

  @Post('runs/:runId/pause')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  pauseRun(@Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string) {
    return this.supplierImportsService.pauseRun(runId);
  }

  @Post('runs/:runId/resume')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  resumeRun(@Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string) {
    return this.supplierImportsService.resumeRun(runId);
  }

  @Post('runs/:runId/archive')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  archiveRun(
    @Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierImportsService.archiveRun(runId, principal.userId);
  }

  @Post('crawl')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  crawlProduct(@Body() dto: StartSupplierCrawlDto) {
    return this.supplierImportsService.crawlProduct(dto);
  }

  @Patch('drafts/:draftId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  updateDraft(
    @Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string,
    @Body() dto: UpdateSupplierImportDraftDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.supplierImportsService.updateDraft(draftId, dto, principal.userId);
  }

  @Get('drafts/:draftId/images/:imageIndex/download')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  async downloadDraftImage(
    @Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string,
    @Param('imageIndex', ParseIntPipe) imageIndex: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.supplierImportsService.downloadDraftImage(draftId, imageIndex);
    response.setHeader('Content-Type', image.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="supplier-product-${imageIndex + 1}"; filename*=UTF-8''${encodeURIComponent(image.filename)}`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(image.body);
  }
}
