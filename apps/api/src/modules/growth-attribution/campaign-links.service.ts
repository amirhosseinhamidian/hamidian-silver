import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { isDirectAttribution, normalizeAttributionToken } from './attribution';
import type { CampaignLinkDto, CreateCampaignLinkDto } from './dto/attribution.dto';

const publicPath = /^\/(?:$|(?:products|categories|brands|guide)(?:\/[^/]+)?\/?$)/;
const destinationParameters = new Set(['page', 'category', 'brand', 'country', 'sort']);

export function buildCampaignUrl(origin: string, input: CreateCampaignLinkDto): CampaignLinkDto {
  const { destination } = input;
  if (
    !destination.startsWith('/') ||
    destination.startsWith('//') ||
    /[\\\p{Cc}]/u.test(destination)
  ) {
    throw new BadRequestException('Choose a public storefront path.');
  }
  const url = new URL(destination, origin);
  if (url.origin !== origin || !publicPath.test(url.pathname) || /%2f|%5c/i.test(url.pathname)) {
    throw new BadRequestException('Choose a public storefront path.');
  }
  for (const [key] of url.searchParams) {
    if (key.toLowerCase().startsWith('utm_'))
      throw new ConflictException('The destination already contains tracking parameters.');
    if (!destinationParameters.has(key) || url.searchParams.getAll(key).length > 1) {
      throw new BadRequestException(
        'The destination contains an unsupported or repeated parameter.',
      );
    }
  }
  const source = normalizeAttributionToken(input.source);
  const medium = normalizeAttributionToken(input.medium);
  const campaign = normalizeAttributionToken(input.campaign);
  const campaignId = normalizeAttributionToken(input.campaignId, 64);
  const content = normalizeAttributionToken(input.content);
  if (
    !source ||
    !medium ||
    !campaign ||
    !campaignId ||
    (input.content?.trim() && !content) ||
    isDirectAttribution(source, medium)
  ) {
    throw new BadRequestException(
      'Campaign identifiers and sources must use valid campaign labels.',
    );
  }
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_id', campaignId);
  if (content) url.searchParams.set('utm_content', content);
  return { url: url.toString(), campaign, campaignId };
}

@Injectable()
export class CampaignLinksService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async create(input: CreateCampaignLinkDto): Promise<CampaignLinkDto> {
    const defaultOrigin =
      this.config.get('NODE_ENV') === 'production'
        ? 'https://hamidian.shop'
        : 'http://localhost:3001';
    const origin = new URL(this.config.get<string>('STOREFRONT_PUBLIC_ORIGIN') ?? defaultOrigin)
      .origin;
    const link = buildCampaignUrl(origin, input);
    await this.prisma.campaignLinkIdentity.createMany({
      data: [{ id: link.campaignId, campaign: link.campaign }],
      skipDuplicates: true,
    });
    const identity = await this.prisma.campaignLinkIdentity.findUnique({
      where: { id: link.campaignId },
    });
    if (identity?.campaign !== link.campaign) {
      throw new ConflictException(
        'This campaign identifier or name is already assigned to another campaign.',
      );
    }
    return link;
  }
}
