import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import {
  CreateGuideArticleDto,
  GuideArticleStatusDto,
  UpdateGuideArticleDto,
} from './dto/guide-article-input.dto';
import {
  AdminGuideArticlesQueryDto,
  PublicGuideArticlesQueryDto,
  PublicRelatedGuideArticlesQueryDto,
} from './dto/guide-query.dto';
import {
  GuideArticleDto,
  GuideArticleListDto,
  GuideArticleSummaryDto,
  GuideTopicDto,
} from './dto/guide-response.dto';
import { CreateGuideTopicDto, UpdateGuideTopicDto } from './dto/guide-topic-input.dto';
import { GuideService } from './guide.service';

@Controller({ path: 'guide', version: '1' })
export class GuideController {
  constructor(private readonly guide: GuideService) {}

  @Public()
  @Get('public/topics')
  @ApiOkResponse({ type: GuideTopicDto, isArray: true })
  listPublicTopics() {
    return this.guide.listPublicTopics();
  }

  @Public()
  @Get('public/articles')
  @ApiOkResponse({ type: GuideArticleListDto })
  listPublicArticles(@Query() query: PublicGuideArticlesQueryDto) {
    return this.guide.listPublicArticles(query);
  }

  @Public()
  @Get('public/related-articles')
  @ApiOkResponse({ type: GuideArticleSummaryDto, isArray: true })
  listPublicRelatedArticles(@Query() query: PublicRelatedGuideArticlesQueryDto) {
    return this.guide.listPublicRelatedArticles(query);
  }

  @Public()
  @Get('public/articles/:slug')
  @ApiOkResponse({ type: GuideArticleDto })
  getPublicArticle(@Param('slug') slug: string) {
    return this.guide.getPublicArticle(slug);
  }

  @Get('topics')
  @RequirePermissions(PERMISSION_CODES.CMS_READ)
  @ApiOkResponse({ type: GuideTopicDto, isArray: true })
  listAdminTopics() {
    return this.guide.listAdminTopics();
  }

  @Post('topics')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiOkResponse({ type: GuideTopicDto })
  createTopic(@Body() dto: CreateGuideTopicDto) {
    return this.guide.createTopic(dto);
  }

  @Patch('topics/:id')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiOkResponse({ type: GuideTopicDto })
  updateTopic(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateGuideTopicDto,
  ) {
    return this.guide.updateTopic(id, dto);
  }

  @Delete('topics/:id')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  deleteTopic(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.guide.deleteTopic(id);
  }

  @Get('articles')
  @RequirePermissions(PERMISSION_CODES.CMS_READ)
  @ApiOkResponse({ type: GuideArticleListDto })
  listAdminArticles(@Query() query: AdminGuideArticlesQueryDto) {
    return this.guide.listAdminArticles(query);
  }

  @Get('articles/:id')
  @RequirePermissions(PERMISSION_CODES.CMS_READ)
  @ApiOkResponse({ type: GuideArticleDto })
  getAdminArticle(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.guide.getAdminArticle(id);
  }

  @Post('articles')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiOkResponse({ type: GuideArticleDto })
  createArticle(
    @Body() dto: CreateGuideArticleDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.guide.createArticle(dto, principal.userId);
  }

  @Patch('articles/:id')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiOkResponse({ type: GuideArticleDto })
  updateArticle(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateGuideArticleDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.guide.updateArticle(id, dto, principal.userId);
  }

  @Patch('articles/:id/status')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiOkResponse({ type: GuideArticleDto })
  updateArticleStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: GuideArticleStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.guide.updateArticleStatus(id, dto, principal.userId);
  }

  @Delete('articles/:id')
  @RequirePermissions(PERMISSION_CODES.CMS_WRITE)
  @ApiQuery({ name: 'expectedVersion', type: Number, minimum: 1 })
  deleteArticle(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('expectedVersion', ParseIntPipe) expectedVersion: number,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.guide.deleteArticle(id, expectedVersion, principal.userId);
  }
}
