import Link from 'next/link';

import { ResponsiveHeroImage } from '@/components/media/responsive-hero-image';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import {
  PUBLIC_CONTENT_PAGE_ROUTES,
  type PublicContentPage,
} from '@/lib/content/public-content-page';

type StorefrontSizeGuideProps = Readonly<{
  page: PublicContentPage;
}>;

const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)] ?? digit);
}

const ringSizes = [
  { size: '3', diameter: '14.0' },
  { size: '3.5', diameter: '14.4' },
  { size: '4', diameter: '14.8' },
  { size: '4.5', diameter: '15.2' },
  { size: '5', diameter: '15.6' },
  { size: '5.5', diameter: '16.0' },
  { size: '6', diameter: '16.45' },
  { size: '6.5', diameter: '16.9' },
  { size: '7', diameter: '17.3' },
  { size: '7.5', diameter: '17.7' },
  { size: '8', diameter: '18.2' },
  { size: '8.5', diameter: '18.6' },
  { size: '9', diameter: '19.0' },
  { size: '9.5', diameter: '19.4' },
  { size: '10', diameter: '19.8' },
  { size: '10.5', diameter: '20.2' },
  { size: '11', diameter: '20.6' },
  { size: '11.5', diameter: '21.0' },
  { size: '12', diameter: '21.4' },
  { size: '12.5', diameter: '21.8' },
  { size: '13', diameter: '22.2' },
  { size: '13.5', diameter: '22.6' },
] as const;

const rulerMarks = Array.from({ length: 31 }, (_, index) => index);

const braceletFits = [
  { fit: 'جذب', extra: '۰٫۵ تا ۱ سانتی‌متر', description: 'نزدیک به مچ و با حرکت کمتر' },
  { fit: 'استاندارد', extra: '۱ تا ۱٫۵ سانتی‌متر', description: 'راحت برای استفاده روزمره' },
  { fit: 'آزاد', extra: '۱٫۵ تا ۲ سانتی‌متر', description: 'آزادتر و با حرکت بیشتر روی دست' },
] as const;

const necklaceLengths = [
  { length: '۳۵ تا ۴۰', title: 'چوکر', description: 'نزدیک گردن؛ مناسب یقه‌های باز' },
  { length: '۴۵', title: 'کلاسیک', description: 'روی استخوان ترقوه؛ انتخابی همه‌کاره' },
  { length: '۵۰', title: 'متوسط', description: 'کمی پایین‌تر از ترقوه؛ مناسب آویز' },
  { length: '۶۰', title: 'بلند', description: 'روی سینه؛ مناسب استایل‌های لایه‌ای' },
  { length: '۷۰ به بالا', title: 'خیلی بلند', description: 'برای ترکیب چندلایه یا استفاده نمایشی' },
] as const;

function GuideHero({ page }: Readonly<{ page: PublicContentPage }>) {
  return (
    <header className="relative isolate aspect-[1086/1448] overflow-hidden bg-[#e9e6df] lg:aspect-[1942/809]">
      {page.heroMedia?.url ? (
        <ResponsiveHeroImage
          desktopSrc={page.heroMedia.url}
          mobileSrc={page.heroMobileMedia?.url}
          alt={page.heroMedia.altText ?? page.title}
          preload
          className="-z-20 object-cover"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -left-[14%] top-[6%] size-[64vw] max-h-[48rem] max-w-[48rem] rounded-full border border-black/10" />
          <div className="absolute -left-[5%] top-[18%] size-[42vw] max-h-[32rem] max-w-[32rem] rounded-full border border-black/15" />
          <div className="absolute bottom-[-20%] right-[5%] size-[38vw] max-h-[30rem] max-w-[30rem] rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff_0,#d7d1c6_35%,#9b9489_70%,#595650_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.28)]" />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.8),rgba(255,255,255,0.08)_65%,rgba(20,20,20,0.12))]" />
        </div>
      )}
      {page.heroMedia?.url ? (
        <div className="absolute inset-0 -z-10 bg-gradient-to-l from-black/55 via-black/15 to-black/5" />
      ) : null}
      <div
        className={`sf-container flex h-full items-end pb-12 pt-28 lg:pb-20 ${page.heroMedia?.url ? 'text-white' : ''}`}
      >
        <div className="max-w-3xl">
          <StorefrontBreadcrumbs
            items={[
              { label: 'خانه', href: '/' },
              { label: page.title, href: PUBLIC_CONTENT_PAGE_ROUTES[page.key] },
            ]}
            className={`mb-7 ${page.heroMedia?.url ? 'text-white/70' : 'text-[var(--sf-color-muted)]'}`}
          />
          {page.eyebrow ? (
            <p
              className={`text-xs tracking-[0.16em] ${page.heroMedia?.url ? 'text-white/75' : 'text-[var(--sf-color-muted)]'}`}
            >
              {page.eyebrow}
            </p>
          ) : null}
          <h1 className="mt-4 text-[clamp(2.7rem,7vw,6rem)] leading-[1.12] font-normal">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p
              className={`mt-6 max-w-2xl text-sm leading-8 sm:text-lg sm:leading-9 ${page.heroMedia?.url ? 'text-white/85' : 'text-[var(--sf-color-muted)]'}`}
            >
              {toPersianDigits(page.subtitle)}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function SectionHeading({
  number,
  title,
  description,
}: Readonly<{ number: string; title: string; description: string }>) {
  return (
    <header className="grid gap-5 border-b border-[var(--sf-color-border)] pb-8 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-10">
      <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">{number}</p>
      <div className="max-w-3xl">
        <h2 className="text-3xl font-normal sm:text-5xl">{title}</h2>
        <p className="mt-5 text-sm leading-8 text-[var(--sf-color-muted)] sm:text-base">
          {description}
        </p>
      </div>
    </header>
  );
}

function RingDiameterRuler() {
  return (
    <figure className="bg-[var(--sf-color-surface)] p-5 sm:p-8">
      <figcaption>
        <p className="text-xs tracking-[0.12em] text-[var(--sf-color-subtle)]">
          روش اندازه‌گیری با خط‌کش
        </p>
        <h3 className="mt-3 text-xl font-normal">قطر داخلی، نه قطر بیرونی</h3>
      </figcaption>

      <div
        role="img"
        aria-label="انگشتر روی خط‌کش با خط اندازه‌گیری از یک لبه داخلی تا لبه داخلی مقابل"
        dir="ltr"
        className="relative mx-auto mt-7 h-72 w-full max-w-lg overflow-hidden bg-white"
      >
        <div className="absolute inset-x-4 top-1/2 h-16 border-y border-black/35 bg-white/90 sm:inset-x-8">
          {rulerMarks.map((mark) => {
            const major = mark % 10 === 0;
            const middle = mark % 5 === 0;

            return (
              <span
                key={mark}
                aria-hidden="true"
                className="absolute top-0 w-px bg-black/70"
                style={{
                  left: `${(mark / 30) * 100}%`,
                  height: major ? '1.8rem' : middle ? '1.3rem' : '0.75rem',
                }}
              >
                {major ? (
                  <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[0.65rem] text-black/65">
                    {toPersianDigits(mark)}
                  </span>
                ) : null}
              </span>
            );
          })}
          <span className="absolute right-1 bottom-0.5 text-[0.6rem] text-black/55">میلی‌متر</span>
        </div>

        <div className="absolute top-1/2 left-1/2 z-10 aspect-square w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-[#ad9147] shadow-[0_18px_36px_rgb(0_0_0/0.14)] sm:w-64 sm:border-[16px]">
          <span
            aria-hidden="true"
            className="absolute -top-10 left-1/2 h-10 w-14 -translate-x-1/2 bg-[#ad9147] [clip-path:polygon(20%_100%,0_35%,20%_0,80%_0,100%_35%,80%_100%)]"
          />
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#a52a2a]">
            <span className="absolute top-1/2 left-0 h-4 w-px -translate-y-1/2 bg-[#a52a2a]" />
            <span className="absolute top-1/2 right-0 h-4 w-px -translate-y-1/2 bg-[#a52a2a]" />
            <span
              dir="rtl"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/90 px-2 py-1 text-xs font-medium text-[#842020]"
            >
              لبه داخلی تا لبه داخلی
            </span>
          </span>
        </div>
      </div>

      <ol className="mt-6 space-y-3 text-sm leading-7 text-[var(--sf-color-muted)]">
        <li>
          <strong className="font-medium text-[var(--sf-color-ink)]">۱.</strong> انگشتر مناسب را
          کاملاً صاف روی یک خط‌کش واقعی قرار دهید.
        </li>
        <li>
          <strong className="font-medium text-[var(--sf-color-ink)]">۲.</strong> صفر خط‌کش را با لبه
          داخلی حلقه هم‌راستا کنید.
        </li>
        <li>
          <strong className="font-medium text-[var(--sf-color-ink)]">۳.</strong> عدد لبه داخلی مقابل
          را به میلی‌متر بخوانید و در جدول پیدا کنید.
        </li>
      </ol>
      <p className="mt-5 border-t border-[var(--sf-color-border)] pt-4 text-xs leading-6 text-[var(--sf-color-subtle)]">
        این تصویر فقط روش اندازه‌گیری را نشان می‌دهد؛ برای تعیین اندازه از خط‌کش فیزیکی استفاده
        کنید.
      </p>
    </figure>
  );
}

function RingGuide() {
  return (
    <section id="rings" className="scroll-mt-28 py-16 sm:py-24">
      <SectionHeading
        number="۰۱"
        title="اندازه انگشتر"
        description="انگشتری را انتخاب کنید که روی همان انگشت به‌خوبی می‌نشیند. آن را صاف روی خط‌کش بگذارید و فاصله میان دو لبه داخلی حلقه را به میلی‌متر بخوانید؛ سپس نزدیک‌ترین اندازه را در جدول پیدا کنید."
      />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <RingDiameterRuler />
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 border-collapse text-right text-sm">
            <caption className="pb-5 text-right text-xs leading-6 text-[var(--sf-color-muted)]">
              جدول تبدیل قطر داخلی به سایز استاندارد انگشتر
            </caption>
            <thead>
              <tr className="border-b border-[var(--sf-color-ink)] text-xs text-[var(--sf-color-muted)]">
                <th scope="col" className="px-3 py-4 font-normal">
                  سایز انگشتر
                </th>
                <th scope="col" className="px-3 py-4 font-normal">
                  قطر داخلی (میلی‌متر)
                </th>
              </tr>
            </thead>
            <tbody>
              {ringSizes.map((row) => (
                <tr key={row.size} className="border-b border-[var(--sf-color-border)]">
                  <td className="px-3 py-4 font-medium">{toPersianDigits(row.size)}</td>
                  <td className="px-3 py-4 text-[var(--sf-color-muted)]">
                    {toPersianDigits(row.diameter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function BraceletGuide() {
  return (
    <section
      id="bracelets"
      className="scroll-mt-28 border-t border-[var(--sf-color-border)] py-16 sm:py-24"
    >
      <SectionHeading
        number="۰۲"
        title="اندازه دستبند"
        description="متر پارچه‌ای را درست روی استخوان مچ و بدون فشار قرار دهید. سپس با توجه به میزان آزادی دلخواه، مقدار پیشنهادی جدول را به اندازه مچ اضافه کنید."
      />
      <div className="mt-10 grid gap-px bg-[var(--sf-color-border)] md:grid-cols-3">
        {braceletFits.map((item) => (
          <article key={item.fit} className="min-h-56 bg-[var(--sf-color-canvas)] p-7 sm:p-9">
            <p className="text-xs text-[var(--sf-color-subtle)]">فرم قرارگیری</p>
            <h3 className="mt-5 text-2xl font-normal">{item.fit}</h3>
            <p className="mt-7 text-lg">افزودن {item.extra}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--sf-color-muted)]">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NecklaceGuide() {
  return (
    <section
      id="necklaces"
      className="scroll-mt-28 border-t border-[var(--sf-color-border)] py-16 sm:py-24"
    >
      <SectionHeading
        number="۰۳"
        title="طول گردنبند"
        description="محل قرارگیری زنجیر به فرم گردن، قد و نوع یقه بستگی دارد. برای تصور بهتر، یک نخ را با طول انتخابی برش دهید و مقابل آینه امتحان کنید."
      />
      <div className="mt-10 border-t border-[var(--sf-color-border)]">
        {necklaceLengths.map((item) => (
          <article
            key={item.length}
            className="grid gap-3 border-b border-[var(--sf-color-border)] py-6 sm:grid-cols-[9rem_10rem_minmax(0,1fr)] sm:items-center sm:gap-8"
          >
            <p className="text-2xl font-normal">
              {item.length} <span className="text-xs text-[var(--sf-color-muted)]">سانتی‌متر</span>
            </p>
            <h3 className="text-base font-medium">{item.title}</h3>
            <p className="text-sm leading-7 text-[var(--sf-color-muted)]">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalCheck() {
  const items = [
    'اندازه‌گیری را در پایان روز و در دمای معمولی انجام داده‌ام.',
    'اندازه را بدون فشار و دست‌کم دو بار بررسی کرده‌ام.',
    'اگر میان دو سایز بوده‌ام، سایز بزرگ‌تر را انتخاب کرده‌ام.',
  ];

  return (
    <section id="final-check" className="scroll-mt-28 bg-[#171717] py-16 text-white sm:py-24">
      <div className="sf-container grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:gap-24">
        <div>
          <p className="text-xs tracking-[0.16em] text-white/55">۰۴ — بررسی نهایی</p>
          <h2 className="mt-5 text-3xl font-normal sm:text-5xl">پیش از ثبت سفارش</h2>
          <ul className="mt-9 space-y-5">
            {items.map((item, index) => (
              <li
                key={item}
                className="flex gap-4 border-t border-white/15 pt-5 text-sm leading-8 text-white/75"
              >
                <span className="text-white/45">{toPersianDigits(index + 1)}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="border border-white/20 p-7 sm:p-9">
          <p className="text-xs text-white/55">هنوز مطمئن نیستید؟</p>
          <h3 className="mt-5 text-2xl font-normal">پیش از خرید از ما بپرسید.</h3>
          <p className="mt-4 text-sm leading-8 text-white/70">
            اندازه ثبت‌شده و مدل محصول را برای کارشناسان گالری بفرستید تا در انتخاب مناسب همراهتان
            باشند.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex min-h-11 items-center border-b border-white px-1 text-sm"
          >
            دریافت مشاوره
          </Link>
        </aside>
      </div>
    </section>
  );
}

export function StorefrontSizeGuide({ page }: StorefrontSizeGuideProps) {
  return (
    <main id="main-content">
      <GuideHero page={page} />
      <nav
        aria-label="بخش‌های راهنمای سایز"
        className="sticky top-0 z-20 border-b border-[var(--sf-color-border)] bg-[color:var(--sf-color-canvas)/0.94] backdrop-blur-md"
      >
        <div className="sf-container flex gap-8 overflow-x-auto py-4 text-sm whitespace-nowrap sm:justify-center sm:gap-14">
          <a href="#rings" className="transition-opacity hover:opacity-50">
            انگشتر
          </a>
          <a href="#bracelets" className="transition-opacity hover:opacity-50">
            دستبند
          </a>
          <a href="#necklaces" className="transition-opacity hover:opacity-50">
            گردنبند
          </a>
          <a href="#final-check" className="transition-opacity hover:opacity-50">
            بررسی نهایی
          </a>
        </div>
      </nav>

      <div className="sf-container">
        {page.body ? (
          <section className="grid gap-7 py-14 sm:grid-cols-[8rem_minmax(0,1fr)] sm:py-20">
            <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">پیش از شروع</p>
            <p className="max-w-3xl whitespace-pre-line text-base leading-9 text-[var(--sf-color-muted)] sm:text-xl sm:leading-10">
              {toPersianDigits(page.body)}
            </p>
          </section>
        ) : null}
        <RingGuide />
        <BraceletGuide />
        <NecklaceGuide />
      </div>

      <FinalCheck />

      {page.sections.length ? (
        <section aria-labelledby="size-guide-notes" className="sf-container py-16 sm:py-24">
          <h2 id="size-guide-notes" className="text-3xl font-normal">
            نکته‌های اندازه‌گیری
          </h2>
          <div className="mt-10 grid gap-px bg-[var(--sf-color-border)] md:grid-cols-3">
            {page.sections.map((section, index) => (
              <article
                key={`${section.title}-${index}`}
                className="min-h-56 bg-[var(--sf-color-canvas)] p-7 sm:p-9"
              >
                <p className="text-xs text-[var(--sf-color-subtle)]">
                  {toPersianDigits(String(index + 1).padStart(2, '0'))}
                </p>
                <h3 className="mt-6 text-xl font-normal">{section.title}</h3>
                {section.body ? (
                  <p className="mt-4 text-sm leading-8 text-[var(--sf-color-muted)]">
                    {toPersianDigits(section.body)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
