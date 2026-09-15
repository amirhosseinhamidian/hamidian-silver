import Image from 'next/image';
import Link from 'next/link';
import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi';

export type StorefrontFooterContent = Readonly<{
  galleryName?: string | null;
  about?: string | null;
  address?: string | null;
  phoneNumbers?: readonly string[] | null;
  email?: string | null;
  social?: Readonly<{
    instagram?: string | null;
    telegram?: string | null;
    bale?: string | null;
  }> | null;
}>;

type StorefrontFooterProps = Readonly<{
  content?: StorefrontFooterContent | null;
}>;

const storefrontLinks = [
  { label: 'محصولات', href: '/products' },
  { label: 'برندها', href: '/brands' },
  { label: 'جدیدترین‌ها', href: '/products?sort=newest' },
] as const;

const informationLinks = [
  { label: 'درباره گالری حمیدیان', href: '/about' },
  { label: 'تماس با ما', href: '/contact' },
  { label: 'خدمات ما', href: '/services' },
  { label: 'راهنمای انتخاب سایز', href: '/size-guide' },
  { label: 'سوالات متداول', href: '/faq' },
] as const;

const ENAMAD_URL = 'https://trustseal.enamad.ir/?id=7736426&Code=fWmqiTtv828G7AiAoC2i3jWBYpzTqDqk';
const ENAMAD_LOGO_URL =
  'https://trustseal.enamad.ir/logo.aspx?id=7736426&Code=fWmqiTtv828G7AiAoC2i3jWBYpzTqDqk';

function normalizeValues(values?: readonly string[] | null): string[] {
  return values?.map((value) => value.trim()).filter(Boolean) ?? [];
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit);
}

export function StorefrontFooter({ content }: StorefrontFooterProps) {
  const galleryName = content?.galleryName?.trim() || 'گالری نقره حمیدیان';
  const about = content?.about?.trim();
  const address = content?.address?.trim();
  const phoneNumbers = normalizeValues(content?.phoneNumbers);
  const email = content?.email?.trim();

  const instagram = content?.social?.instagram?.trim();
  const telegram = content?.social?.telegram?.trim();
  const bale = content?.social?.bale?.trim();
  const hasSocialLinks = Boolean(instagram || telegram || bale);
  const hasContactDetails = Boolean(address || phoneNumbers.length || email);

  return (
    <footer className="border-t border-[var(--sf-color-border)] bg-[var(--sf-color-surface)]">
      <div
        className="
          sf-container grid gap-10 py-12
          md:grid-cols-2 lg:grid-cols-4 lg:py-16
        "
      >
        <div>
          <Link href="/" aria-label="نقره حمیدیان، صفحه اصلی" className="relative block h-20 w-44">
            <Image
              src="/brand/hamidian-signature.png"
              alt="لوگوی نقره حمیدیان"
              fill
              sizes="176px"
              className="object-contain object-right"
            />
          </Link>

          {about ? (
            <div className="mt-6">
              <h2 className="text-sm font-medium">درباره {galleryName}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--sf-color-muted)]">{about}</p>
            </div>
          ) : null}
        </div>

        <nav aria-label="لینک‌های فروشگاه">
          <h2 className="text-sm font-medium">فروشگاه</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--sf-color-muted)]">
            {storefrontLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-opacity hover:opacity-55">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="اطلاعات گالری">
          <h2 className="text-sm font-medium">اطلاعات</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--sf-color-muted)]">
            {informationLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-opacity hover:opacity-55">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          {hasContactDetails ? (
            <section aria-labelledby="storefront-contact-title">
              <h2 id="storefront-contact-title" className="text-sm font-medium">
                ارتباط با گالری
              </h2>

              <div dir="rtl" className="mt-4 space-y-3 text-sm text-[var(--sf-color-muted)]">
                {address ? (
                  <p className="flex items-start gap-2 leading-7">
                    <FiMapPin aria-hidden="true" className="mt-1 shrink-0" size={16} />
                    <span>{toPersianDigits(address)}</span>
                  </p>
                ) : null}

                {phoneNumbers.map((phoneNumber) => (
                  <a
                    key={phoneNumber}
                    href={`tel:${phoneNumber}`}
                    dir="rtl"
                    className="flex w-fit items-center gap-2 transition-opacity hover:opacity-55"
                  >
                    <FiPhone aria-hidden="true" className="shrink-0" size={16} />
                    <span dir="ltr">{toPersianDigits(phoneNumber)}</span>
                  </a>
                ))}

                {email ? (
                  <a
                    href={`mailto:${email}`}
                    dir="rtl"
                    className="flex w-fit items-center gap-2 transition-opacity hover:opacity-55"
                  >
                    <FiMail aria-hidden="true" className="shrink-0" size={16} />
                    <span dir="ltr">{toPersianDigits(email)}</span>
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          {hasSocialLinks ? (
            <section
              aria-labelledby="storefront-social-title"
              className={hasContactDetails ? 'mt-8' : undefined}
            >
              <h2 id="storefront-social-title" className="text-sm font-medium">
                شبکه‌های اجتماعی
              </h2>

              <div className="mt-4 flex items-center gap-4">
                {instagram ? (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="اینستاگرام گالری حمیدیان"
                    className="transition-opacity hover:opacity-55"
                  >
                    <FaInstagram aria-hidden="true" size={20} />
                  </a>
                ) : null}

                {telegram ? (
                  <a
                    href={telegram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="تلگرام گالری حمیدیان"
                    className="transition-opacity hover:opacity-55"
                  >
                    <FaTelegramPlane aria-hidden="true" size={20} />
                  </a>
                ) : null}

                {bale ? (
                  <a
                    href={bale}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="بله گالری حمیدیان"
                    className="transition-opacity hover:opacity-55"
                  >
                    <Image
                      src="/icons/social/bale.svg"
                      alt=""
                      aria-hidden="true"
                      width={20}
                      height={20}
                    />
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <section
            aria-labelledby="storefront-enamad-title"
            className={hasContactDetails || hasSocialLinks ? 'mt-8' : undefined}
          >
            <h2 id="storefront-enamad-title" className="text-sm font-medium">
              نماد اعتماد
            </h2>

            <a
              href={ENAMAD_URL}
              target="_blank"
              rel="noopener"
              referrerPolicy="origin"
              aria-label="مشاهده اعتبار نماد اعتماد الکترونیکی گالری حمیدیان"
              className="mt-4 inline-flex size-20 items-center justify-center overflow-hidden rounded-xl border border-[var(--sf-color-border)] bg-white p-1.5 transition-opacity hover:opacity-70"
            >
              {/* The trust seal must be loaded directly so Enamad receives the page origin. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ENAMAD_LOGO_URL}
                alt="نماد اعتماد الکترونیکی گالری حمیدیان"
                width={64}
                height={64}
                referrerPolicy="origin"
                loading="lazy"
                className="size-16 object-contain"
              />
            </a>
          </section>
        </div>
      </div>

      <div className="border-t border-[var(--sf-color-border)]">
        <div
          className="
            sf-container flex flex-col gap-3 py-5 text-xs
            text-[var(--sf-color-muted)] sm:flex-row sm:items-center sm:justify-between
          "
        >
          <p>تمامی حقوق برای گالری نقره حمیدیان محفوظ است.</p>
          <div className="flex items-center gap-5">
            <Link href="/terms">شرایط و قوانین</Link>
            <Link href="/privacy">حریم خصوصی</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
