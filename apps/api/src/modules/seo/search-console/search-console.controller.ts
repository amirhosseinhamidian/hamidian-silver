import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  type ExceptionFilter,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RequirePermissions } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import {
  SearchConsoleBrandPerformanceDto,
  SearchConsoleConnectionDto,
  SearchConsolePerformanceDto,
  SearchConsolePerformanceQueryDto,
  SearchConsolePeriodDto,
  SearchConsoleSitemapsDto,
} from '../dto/search-console.dto';
import { SearchConsoleError, type SearchConsoleErrorCode } from './search-console-errors';
import { SearchConsoleService } from './search-console.service';

const statuses: Record<SearchConsoleErrorCode, number> = {
  not_configured: 503,
  invalid_credentials: 503,
  authentication_failed: 502,
  access_denied: 502,
  property_not_found: 502,
  quota_exceeded: 429,
  rate_limited: 429,
  busy: 429,
  invalid_query: 422,
  timeout: 504,
  upstream_unavailable: 503,
  invalid_response: 502,
};

@Catch(SearchConsoleError)
export class SearchConsoleExceptionFilter implements ExceptionFilter {
  catch(exception: SearchConsoleError, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (exception.retryAfterSeconds !== undefined)
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(statuses[exception.code]).json({
      success: false,
      error: { code: exception.code, message: exception.message },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.path,
        requestId: request.headers['x-request-id']?.toString() ?? 'unknown',
      },
    });
  }
}

@ApiTags('SEO')
@Controller('seo/search-console')
@UseFilters(SearchConsoleExceptionFilter)
export class SearchConsoleController {
  constructor(private readonly searchConsole: SearchConsoleService) {}

  @Get('connection')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: SearchConsoleConnectionDto })
  connection() {
    return this.searchConsole.connection();
  }

  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Post('performance')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SearchConsolePerformanceDto })
  performance(@Body() input: SearchConsolePerformanceQueryDto) {
    return this.searchConsole.performance(input);
  }

  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @Post('brand-performance')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: SearchConsoleBrandPerformanceDto })
  brandPerformance(@Body() period: SearchConsolePeriodDto) {
    return this.searchConsole.brandPerformance(period);
  }

  @Get('sitemaps')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(PERMISSION_CODES.SETTINGS_READ)
  @ApiOkResponse({ type: SearchConsoleSitemapsDto })
  sitemaps() {
    return this.searchConsole.sitemaps();
  }
}
