import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, PickType } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { selectCampaignProducts } from '../campaigns/campaign-selection';
import {
  CampaignProductOptionsDto,
  CampaignProductQueryDto,
} from '../campaigns/dto/campaign-operations.dto';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { policyBasketVariantScope } from './policy-simulation-basket';

class PolicyProductSearchDto extends PickType(CampaignProductQueryDto, [
  'q',
  'page',
  'stock',
  'category',
  'brand',
  'categoryMode',
]) {}

class PolicySelectedProductsDto extends PickType(CampaignProductQueryDto, ['selected']) {}

class PolicyProductSlugDto {
  @ApiProperty({ minLength: 1, maxLength: 220 })
  @IsString()
  @Length(1, 220)
  slug!: string;
}

class PolicyVariantOptionDto {
  @ApiProperty() sku!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: Number, nullable: true }) salePriceToman!: number | null;
}

@Controller({ path: 'reward-policies/policy-simulator/product-options', version: '1' })
@RequirePermissions(PERMISSION_CODES.FINANCE_READ)
export class PolicyProductOptionsController {
  constructor(
    private readonly db: PrismaService,
    private readonly media: PublicMediaUrlService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: CampaignProductOptionsDto })
  search(@Query() query: PolicyProductSearchDto) {
    return selectCampaignProducts(this.db, this.media, query);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: CampaignProductOptionsDto })
  hydrate(@Body() query: PolicySelectedProductsDto) {
    return selectCampaignProducts(this.db, this.media, { selected: query.selected ?? [] });
  }

  @Get(':slug/variants')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PolicyVariantOptionDto, isArray: true })
  variants(@Param() { slug }: PolicyProductSlugDto) {
    return this.db.productVariant.findMany({
      where: {
        ...policyBasketVariantScope,
        product: { slug, status: 'ACTIVE', deletedAt: null },
      },
      select: { sku: true, name: true, salePriceToman: true },
      orderBy: [{ name: 'asc' }, { sku: 'asc' }],
    });
  }
}
