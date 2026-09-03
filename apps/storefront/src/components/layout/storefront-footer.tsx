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
] as const;

function normalizeValues(values?: readonly string[] | null): string[] {
  return values?.map((value) => value.trim()).filter(Boolean) ?? [];
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
          <Link
            href="/"
            aria-label="نقره حمیدیان، صفحه اصلی"
            className="relative block h-20 w-44"
          >
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

              <div className="mt-4 space-y-3 text-sm text-[var(--sf-color-muted)]">
                {address ? (
                  <p className="flex items-start gap-2 leading-7">
                    <FiMapPin aria-hidden="true" className="mt-1 shrink-0" size={16} />
                    <span>{address}</span>
                  </p>
                ) : null}

                {phoneNumbers.map((phoneNumber) => (
                  <a
                    key={phoneNumber}
                    href={`tel:${phoneNumber}`}
                    dir="ltr"
                    className="flex w-fit items-center gap-2 transition-opacity hover:opacity-55"
                  >
                    <FiPhone aria-hidden="true" size={16} />
                    <span>{phoneNumber}</span>
                  </a>
                ))}

                {email ? (
                  <a
                    href={`mailto:${email}`}
                    dir="ltr"
                    className="flex w-fit items-center gap-2 transition-opacity hover:opacity-55"
                  >
                    <FiMail aria-hidden="true" size={16} />
                    <span>{email}</span>
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
