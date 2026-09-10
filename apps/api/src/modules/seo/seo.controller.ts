import { Controller, Get, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ResolveSeoRedirectQueryDto } from './dto/resolve-seo-redirect-query.dto';
import { SeoRedirectResponseDto } from './dto/seo-redirect-response.dto';
import { SeoRedirectsService } from './seo-redirects.service';

@ApiTags('SEO')
@Controller('seo')
export class SeoController {
  constructor(private readonly redirects: SeoRedirectsService) {}

  @Public()
  @Get('redirects/resolve')
  @ApiOkResponse({ type: SeoRedirectResponseDto })
  @ApiNotFoundResponse()
  resolveRedirect(@Query() query: ResolveSeoRedirectQueryDto) {
    return this.redirects.resolve(query.path);
  }
}
