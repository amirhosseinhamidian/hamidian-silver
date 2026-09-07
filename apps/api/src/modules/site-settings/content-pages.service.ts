import { BadRequestException, Injectable } from '@nestjs/common';

import { StorefrontContentPageKey } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { AdminContentPageDto } from './dto/admin-content-page.dto';
import { PublicContentPageDto, PublicContentPageMediaDto } from './dto/public-content-page.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';

const CONTENT_PAGE_KEYS = Object.values(StorefrontContentPageKey);
const IMAGE_REQUIRED_KEYS = new Set<StorefrontContentPageKey>([
  StorefrontContentPageKey.ABOUT,
  StorefrontContentPageKey.CONTACT,
  StorefrontContentPageKey.SERVICES,
]);

type ContentMedia = Readonly<{
  storageKey: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  deletedAt: Date | null;
}>;

type ContentPageRecord = Readonly<{
  key: StorefrontContentPageKey;
  title: string;
  eyebrow: string | null;
  subtitle: string | null;
  body: string | null;
  heroMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
  heroMedia: ContentMedia | null;
  sections: ReadonlyArray<Readonly<{ title: string; body: string | null }>>;
}>;

const DEFAULT_CONTENT: Record<StorefrontContentPageKey, PublicContentPageDto> = {
  [StorefrontContentPageKey.ABOUT]: {
    key: StorefrontContentPageKey.ABOUT,
    eyebrow: 'درباره ما',
    title: 'روایت نقره حمیدیان',
    subtitle: 'زیبایی ماندگار، انتخاب آگاهانه و تجربه‌ای که با اعتماد ساخته می‌شود.',
    body: 'نقره حمیدیان با تمرکز بر انتخاب دقیق، اصالت محصول و همراهی صادقانه شکل گرفته است. هر قطعه برای ما بخشی از یک روایت شخصی است؛ روایتی که باید سال‌ها درخشان بماند.',
    heroMedia: null,
    sections: [
      {
        title: 'انتخاب دقیق',
        body: 'مجموعه‌ها با توجه به کیفیت ساخت، فرم و ماندگاری انتخاب می‌شوند.',
      },
      {
        title: 'اعتماد و اصالت',
        body: 'شفافیت اطلاعات و تضمین کیفیت، پایه ارتباط ما با مشتری است.',
      },
      { title: 'همراهی ماندگار', body: 'از انتخاب تا نگهداری محصول، کنار شما باقی می‌مانیم.' },
    ],
    seoTitle: 'درباره نقره حمیدیان',
    seoDescription: 'با داستان، ارزش‌ها و نگاه گالری نقره حمیدیان آشنا شوید.',
  },
  [StorefrontContentPageKey.CONTACT]: {
    key: StorefrontContentPageKey.CONTACT,
    eyebrow: 'تماس با ما',
    title: 'در تماس باشیم',
    subtitle: 'برای مشاوره انتخاب، پیگیری سفارش و دریافت راهنمایی همراه شما هستیم.',
    body: 'از راه‌های ارتباطی این صفحه با گالری در تماس باشید. همکاران ما در اولین فرصت پاسخ‌گوی شما خواهند بود.',
    heroMedia: null,
    sections: [],
    seoTitle: 'تماس با نقره حمیدیان',
    seoDescription: 'راه‌های ارتباط با گالری نقره حمیدیان و دریافت مشاوره.',
  },
  [StorefrontContentPageKey.SERVICES]: {
    key: StorefrontContentPageKey.SERVICES,
    eyebrow: 'خدمات ما',
    title: 'همراهی فراتر از خرید',
    subtitle: 'خدماتی دقیق و شخصی برای تجربه‌ای آرام از انتخاب تا نگهداری نقره.',
    body: 'خدمات گالری با هدف حفظ کیفیت محصول و اطمینان شما در تمام مراحل خرید ارائه می‌شود.',
    heroMedia: null,
    sections: [
      {
        title: 'مشاوره انتخاب',
        body: 'راهنمایی برای انتخاب مدل، سایز و ترکیب مناسب با سلیقه شما.',
      },
      { title: 'راهنمای نگهداری', body: 'آموزش اصول مراقبت از نقره برای حفظ درخشندگی و کیفیت.' },
      { title: 'پیگیری سفارش', body: 'پاسخ‌گویی و همراهی شفاف از ثبت سفارش تا تحویل.' },
    ],
    seoTitle: 'خدمات نقره حمیدیان',
    seoDescription: 'آشنایی با خدمات مشاوره، نگهداری و پشتیبانی گالری نقره حمیدیان.',
  },
  [StorefrontContentPageKey.TERMS]: {
    key: StorefrontContentPageKey.TERMS,
    eyebrow: 'اطلاعات حقوقی',
    title: 'شرایط و قوانین',
    subtitle: 'چارچوب استفاده از فروشگاه و ثبت سفارش در نقره حمیدیان.',
    body: 'ثبت سفارش در فروشگاه به معنای مطالعه و پذیرش شرایط خرید، شیوه ارسال و ضوابط اعلام‌شده در زمان سفارش است.\n\nاطلاعات نهایی هر محصول، مبلغ قابل پرداخت و شرایط تحویل پیش از پرداخت به کاربر نمایش داده می‌شود.',
    heroMedia: null,
    sections: [],
    seoTitle: 'شرایط و قوانین نقره حمیدیان',
    seoDescription: 'شرایط استفاده، ثبت سفارش و خرید از فروشگاه نقره حمیدیان.',
  },
  [StorefrontContentPageKey.PRIVACY]: {
    key: StorefrontContentPageKey.PRIVACY,
    eyebrow: 'اطلاعات حقوقی',
    title: 'حریم خصوصی',
    subtitle: 'شفافیت در نگهداری و استفاده از اطلاعات شما برای ما یک اصل است.',
    body: 'اطلاعات کاربران تنها برای ارائه خدمات فروشگاه، پردازش سفارش و ارتباط ضروری استفاده می‌شود. دسترسی به این اطلاعات محدود و متناسب با نیاز عملیاتی است.\n\nنقره حمیدیان اطلاعات شخصی کاربران را خارج از الزامات قانونی و ارائه خدمات در اختیار اشخاص غیرمرتبط قرار نمی‌دهد.',
    heroMedia: null,
    sections: [],
    seoTitle: 'حریم خصوصی نقره حمیدیان',
    seoDescription: 'سیاست حفظ حریم خصوصی و نحوه استفاده از اطلاعات کاربران نقره حمیدیان.',
  },
};

function nullableText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

@Injectable()
export class ContentPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicMediaUrlService: PublicMediaUrlService,
  ) {}

  async getPublicPage(key: StorefrontContentPageKey): Promise<PublicContentPageDto> {
    const page = await this.findPage(key);
    return page ? this.projectPublic(page) : DEFAULT_CONTENT[key];
  }

  async getAdminPages(): Promise<AdminContentPageDto[]> {
    const pages = await this.prisma.storefrontContentPage.findMany({
      include: { heroMedia: true, sections: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });
    const pageByKey = new Map(pages.map((page) => [page.key, page] as const));

    return CONTENT_PAGE_KEYS.map((key) => {
      const page = pageByKey.get(key) as ContentPageRecord | undefined;
      if (page) return this.projectAdmin(page);

      const fallback = DEFAULT_CONTENT[key];
      return {
        ...fallback,
        heroMediaId: null,
        updatedByUserId: null,
        updatedAt: null,
      };
    });
  }

  async updatePage(
    key: StorefrontContentPageKey,
    dto: UpdateContentPageDto,
    actorUserId: string,
  ): Promise<AdminContentPageDto> {
    const current = await this.prisma.storefrontContentPage.findUnique({
      where: { key },
      select: { heroMediaId: true },
    });
    const heroMediaId =
      dto.heroMediaId === undefined ? (current?.heroMediaId ?? null) : dto.heroMediaId;

    await this.validateHeroMedia(key, heroMediaId);

    const normalized = {
      title: dto.title.trim(),
      eyebrow: nullableText(dto.eyebrow),
      subtitle: nullableText(dto.subtitle),
      body: nullableText(dto.body),
      heroMediaId,
      seoTitle: nullableText(dto.seoTitle),
      seoDescription: nullableText(dto.seoDescription),
      updatedByUserId: actorUserId,
    };
    const sections = dto.sections.map((section, index) => ({
      pageKey: key,
      title: section.title.trim(),
      body: nullableText(section.body),
      sortOrder: index + 1,
    }));

    await this.prisma.$transaction(async (transaction) => {
      await transaction.storefrontContentPage.upsert({
        where: { key },
        create: { key, ...normalized },
        update: normalized,
      });
      await transaction.storefrontContentSection.deleteMany({ where: { pageKey: key } });
      if (sections.length > 0) {
        await transaction.storefrontContentSection.createMany({ data: sections });
      }
    });

    const page = await this.findPage(key);
    if (!page) throw new Error('Updated content page could not be read.');
    return this.projectAdmin(page);
  }

  private findPage(key: StorefrontContentPageKey): Promise<ContentPageRecord | null> {
    return this.prisma.storefrontContentPage.findUnique({
      where: { key },
      include: { heroMedia: true, sections: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });
  }

  private async validateHeroMedia(
    key: StorefrontContentPageKey,
    heroMediaId: string | null,
  ): Promise<void> {
    if (IMAGE_REQUIRED_KEYS.has(key) && !heroMediaId) {
      throw new BadRequestException('A hero image is required for this storefront page.');
    }
    if (!heroMediaId) return;

    const media = await this.prisma.media.findFirst({
      where: { id: heroMediaId, deletedAt: null },
      select: { mimeType: true },
    });
    if (!media?.mimeType.startsWith('image/')) {
      throw new BadRequestException('Content page hero media must reference an active image.');
    }
  }

  private projectPublic(page: ContentPageRecord): PublicContentPageDto {
    return {
      key: page.key,
      title: page.title,
      eyebrow: page.eyebrow,
      subtitle: page.subtitle,
      body: page.body,
      heroMedia: this.projectMedia(page.heroMedia),
      sections: page.sections.map(({ title, body }) => ({ title, body })),
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
    };
  }

  private projectAdmin(page: ContentPageRecord): AdminContentPageDto {
    return {
      ...this.projectPublic(page),
      heroMediaId: page.heroMediaId,
      updatedByUserId: page.updatedByUserId,
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  private projectMedia(media: ContentMedia | null): PublicContentPageMediaDto | null {
    if (!media || media.deletedAt) return null;
    return {
      url: this.publicMediaUrlService.resolve(media.storageKey),
      altText: media.altText,
      width: media.width,
      height: media.height,
    };
  }
}
