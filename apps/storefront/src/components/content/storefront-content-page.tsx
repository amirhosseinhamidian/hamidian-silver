import Image from 'next/image';
import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi';

import { ContentPageHero } from '@/components/content/content-page-hero';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import {
  PUBLIC_CONTENT_PAGE_ROUTES,
  type PublicContentPage,
} from '@/lib/content/public-content-page';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type ContentPageKind = 'about' | 'contact' | 'services' | 'legal';

type StorefrontContentPageProps = Readonly<{
  page: PublicContentPage;
  kind: ContentPageKind;
  settings?: PublicSiteSettings;
}>;

type ContactSocialLink = Readonly<{
  href: string;
  label: string;
  kind: 'instagram' | 'telegram' | 'bale';
}>;

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit);
}

function PageBody({ body }: Readonly<{ body: string | null }>) {
  if (!body) return null;
  return (
    <p className="whitespace-pre-line text-base leading-9 text-[var(--sf-color-muted)] sm:text-lg sm:leading-10">
      {toPersianDigits(body)}
    </p>
  );
}

function EditorialContent({ page }: Readonly<{ page: PublicContentPage }>) {
  return (
    <div className="sf-container py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-24">
        <p className="text-xs tracking-[0.2em] text-[var(--sf-color-subtle)]">HAMIDIAN SILVER</p>
        <PageBody body={page.body} />
      </div>
      {page.sections.length ? (
        <div className="mt-16 grid border-t border-[var(--sf-color-border)] sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-[var(--sf-color-border)]">
          {page.sections.map((section, index) => (
            <article
              key={`${section.title}-${index}`}
              className="border-b border-[var(--sf-color-border)] py-9 sm:border-b-0 sm:px-8 sm:first:pr-0 sm:last:pl-0"
            >
              <p className="text-xs text-[var(--sf-color-subtle)]">
                {toPersianDigits(String(index + 1).padStart(2, '0'))}
              </p>
              <h2 className="mt-5 text-2xl font-normal">{section.title}</h2>
              {section.body ? (
                <p className="mt-4 text-sm leading-8 text-[var(--sf-color-muted)]">
                  {toPersianDigits(section.body)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ServicesContent({ page }: Readonly<{ page: PublicContentPage }>) {
  return (
    <div className="sf-container py-16 sm:py-24">
      <div className="max-w-3xl">
        <PageBody body={page.body} />
      </div>
      <div className="mt-14 grid gap-px bg-[var(--sf-color-border)] sm:grid-cols-2 lg:grid-cols-3">
        {page.sections.map((section, index) => (
          <article
            key={`${section.title}-${index}`}
            className="min-h-64 bg-[var(--sf-color-canvas)] p-8 sm:p-10"
          >
            <p className="text-xs tracking-[0.12em] text-[var(--sf-color-subtle)]">
              خدمت {toPersianDigits(String(index + 1).padStart(2, '0'))}
            </p>
            <h2 className="mt-10 text-2xl font-normal">{section.title}</h2>
            {section.body ? (
              <p className="mt-5 text-sm leading-8 text-[var(--sf-color-muted)]">
                {toPersianDigits(section.body)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function ContactContent({
  page,
  settings,
}: Readonly<{ page: PublicContentPage; settings?: PublicSiteSettings }>) {
  const phoneNumbers = settings?.contactPhoneNumbers ?? [];
  const socialLinks: ContactSocialLink[] = [];
  if (settings?.instagramUrl) {
    socialLinks.push({ href: settings.instagramUrl, label: 'اینستاگرام', kind: 'instagram' });
  }
  if (settings?.telegramUrl) {
    socialLinks.push({ href: settings.telegramUrl, label: 'تلگرام', kind: 'telegram' });
  }
  if (settings?.baleUrl) {
    socialLinks.push({ href: settings.baleUrl, label: 'بله', kind: 'bale' });
  }
  const hasContactDetails = Boolean(
    settings?.contactAddress || phoneNumbers.length || settings?.contactEmail || socialLinks.length,
  );

  return (
    <div className="sf-container py-16 sm:py-24">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-24">
        <div>
          <PageBody body={page.body} />
        </div>
        <div className="border-t border-[var(--sf-color-border)]">
          {!hasContactDetails ? (
            <p className="border-b border-[var(--sf-color-border)] py-7 text-sm leading-8 text-[var(--sf-color-muted)]">
              اطلاعات تماس گالری به‌زودی در این بخش قرار می‌گیرد.
            </p>
          ) : null}
          {settings?.contactAddress ? (
            <div className="flex gap-4 border-b border-[var(--sf-color-border)] py-7">
              <FiMapPin aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="text-sm font-medium">نشانی گالری</h2>
                <p className="mt-2 text-sm leading-8 text-[var(--sf-color-muted)]">
                  {toPersianDigits(settings.contactAddress)}
                </p>
              </div>
            </div>
          ) : null}
          {phoneNumbers.length ? (
            <div className="flex gap-4 border-b border-[var(--sf-color-border)] py-7">
              <FiPhone aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="text-sm font-medium">شماره تماس</h2>
                <div className="mt-2 space-y-2">
                  {phoneNumbers.map((phone) => (
                    <a
                      key={phone}
                      href={`tel:${phone}`}
                      dir="ltr"
                      className="block w-fit text-sm text-[var(--sf-color-muted)] transition-opacity hover:opacity-55"
                    >
                      {toPersianDigits(phone)}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {settings?.contactEmail ? (
            <div className="flex gap-4 border-b border-[var(--sf-color-border)] py-7">
              <FiMail aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="text-sm font-medium">ایمیل</h2>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  dir="ltr"
                  className="mt-2 block text-sm text-[var(--sf-color-muted)] transition-opacity hover:opacity-55"
                >
                  {settings.contactEmail}
                </a>
              </div>
            </div>
          ) : null}
          {socialLinks.length ? (
            <section aria-labelledby="contact-social-title" className="py-8">
              <h2 id="contact-social-title" className="text-sm font-medium">
                شبکه‌های اجتماعی
              </h2>
              <p className="mt-2 text-xs leading-6 text-[var(--sf-color-subtle)]">
                تازه‌ترین محصولات و خبرهای گالری را دنبال کنید.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                {socialLinks.map(({ href, label, kind }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="
                      group relative inline-flex items-center gap-2.5 py-2 text-sm
                      text-[var(--sf-color-muted)] outline-none transition-colors
                      duration-500 ease-out hover:text-[var(--sf-color-ink)]
                      focus-visible:text-[var(--sf-color-ink)]
                    "
                  >
                    <span
                      aria-hidden="true"
                      className="
                        grid size-6 place-items-center transition-transform duration-700
                        ease-out group-hover:-translate-y-0.5 group-hover:scale-105
                        group-focus-visible:-translate-y-0.5 group-focus-visible:scale-105
                      "
                    >
                      {kind === 'instagram' ? <FaInstagram className="size-5" /> : null}
                      {kind === 'telegram' ? <FaTelegramPlane className="size-5" /> : null}
                      {kind === 'bale' ? (
                        <Image src="/icons/social/bale.svg" alt="" width={20} height={20} />
                      ) : null}
                    </span>
                    <span>{label}</span>
                    <span
                      aria-hidden="true"
                      className="
                        absolute inset-x-0 bottom-0 h-px origin-right scale-x-0
                        bg-[var(--sf-color-ink)] transition-transform duration-700 ease-out
                        group-hover:scale-x-100 group-focus-visible:scale-x-100
                      "
                    />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LegalContent({ page }: Readonly<{ page: PublicContentPage }>) {
  return (
    <main id="main-content" className="sf-container py-12 sm:py-20">
      <header className="max-w-4xl border-b border-[var(--sf-color-border)] pb-10 sm:pb-14">
        <StorefrontBreadcrumbs
          items={[
            { label: 'خانه', href: '/' },
            { label: page.title, href: PUBLIC_CONTENT_PAGE_ROUTES[page.key] },
          ]}
          className="mb-8 text-[var(--sf-color-muted)]"
        />
        {page.eyebrow ? (
          <p className="text-sm text-[var(--sf-color-muted)]">{page.eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-4xl font-normal sm:text-6xl">{page.title}</h1>
        {page.subtitle ? (
          <p className="mt-6 max-w-2xl text-sm leading-8 text-[var(--sf-color-muted)] sm:text-base">
            {page.subtitle}
          </p>
        ) : null}
      </header>
      <article className="max-w-3xl py-10 sm:py-16">
        <PageBody body={page.body} />
        {page.sections.map((section, index) => (
          <section key={`${section.title}-${index}`} className="mt-12">
            <h2 className="text-2xl font-normal">{section.title}</h2>
            {section.body ? (
              <div className="mt-4">
                <PageBody body={section.body} />
              </div>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}

export function StorefrontContentPage({ page, kind, settings }: StorefrontContentPageProps) {
  if (kind === 'legal') return <LegalContent page={page} />;

  return (
    <main id="main-content">
      <ContentPageHero page={page} />
      {kind === 'about' ? <EditorialContent page={page} /> : null}
      {kind === 'services' ? <ServicesContent page={page} /> : null}
      {kind === 'contact' ? <ContactContent page={page} settings={settings} /> : null}
    </main>
  );
}
