import { Controller, Get, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PublicSeoSitemapResponseDto } from './dto/public-seo-sitemap-response.dto';
import { ResolveSeoRedirectQueryDto } from './dto/resolve-seo-redirect-query.dto';
import { SeoRedirectResponseDto } from './dto/seo-redirect-response.dto';
import { SeoRedirectsService } from './seo-redirects.service';
import { SeoSitemapService } from './seo-sitemap.service';

@ApiTags('SEO')
@Controller('seo')
export class SeoController {
  constructor(
    private readonly redirects: SeoRedirectsService,
    private readonly sitemap: SeoSitemapService,
  ) {}

  @Public()
  @Get('sitemap')
  @ApiOkResponse({ type: PublicSeoSitemapResponseDto })
  getPublicSitemap() {
    return this.sitemap.getPublicSitemap();
  }

  @Public()
  @Get('redirects/resolve')
  @ApiOkResponse({ type: SeoRedirectResponseDto })
  @ApiNotFoundResponse()
  resolveRedirect(@Query() query: ResolveSeoRedirectQueryDto) {
    return this.redirects.resolve(query.path);
  }
}
