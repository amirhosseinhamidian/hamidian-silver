import { FaInstagram, FaTelegramPlane } from 'react-icons/fa';
import { FiMail, FiMapPin, FiMessageCircle, FiPhone } from 'react-icons/fi';

import { ContentPageHero } from '@/components/content/content-page-hero';
import type { PublicContentPage } from '@/lib/content/public-content-page';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

type ContentPageKind = 'about' | 'contact' | 'services' | 'legal';

type StorefrontContentPageProps = Readonly<{
  page: PublicContentPage;
  kind: ContentPageKind;
  settings?: PublicSiteSettings;
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
  const socialLinks = [
    settings?.instagramUrl
      ? { href: settings.instagramUrl, label: 'اینستاگرام', icon: FaInstagram }
      : null,
    settings?.telegramUrl
      ? { href: settings.telegramUrl, label: 'تلگرام', icon: FaTelegramPlane }
      : null,
    settings?.baleUrl
      ? { href: settings.baleUrl, label: 'بله', icon: FiMessageCircle }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const hasContactDetails = Boolean(
    settings?.contactAddress ||
      phoneNumbers.length ||
      settings?.contactEmail ||
      socialLinks.length,
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
            <div className="flex items-center gap-5 py-7">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex size-11 items-center justify-center border border-[var(--sf-color-border)] transition-colors hover:border-[var(--sf-color-ink)]"
                >
                  <Icon aria-hidden="true" className="size-5" />
                </a>
              ))}
            </div>
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
