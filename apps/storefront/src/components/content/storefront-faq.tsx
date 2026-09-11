'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { FiArrowLeft, FiMinus, FiPlus, FiSearch } from 'react-icons/fi';

import { StorefrontImage } from '@/components/media/storefront-image';
import type { PublicContentPage } from '@/lib/content/public-content-page';

type StorefrontFaqProps = Readonly<{
  page: PublicContentPage;
  breadcrumbs?: ReactNode;
}>;

const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => persianDigits[Number(digit)] ?? digit);
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('fa-IR').replace(/\s+/g, ' ');
}

const supportLinks = [
  {
    eyebrow: 'پیش از خرید',
    title: 'راهنمای انتخاب سایز',
    description: 'اندازه‌گیری انگشتر، دستبند و گردنبند',
    href: '/size-guide',
  },
  {
    eyebrow: 'پس از خرید',
    title: 'پیگیری سفارش',
    description: 'مشاهده وضعیت سفارش، پرداخت و کد رهگیری',
    href: '/account',
  },
  {
    eyebrow: 'پاسخ اختصاصی',
    title: 'ارتباط با پشتیبانی',
    description: 'مشاوره پیش از خرید و بررسی مشکلات سفارش',
    href: '/contact',
  },
] as const;

export function StorefrontFaq({ page, breadcrumbs }: StorefrontFaqProps) {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const normalizedQuery = normalizeSearchValue(query);
  const questions = useMemo(
    () =>
      page.sections.filter((section) => {
        if (!normalizedQuery) return true;
        return normalizeSearchValue(`${section.title} ${section.body ?? ''}`).includes(
          normalizedQuery,
        );
      }),
    [normalizedQuery, page.sections],
  );

  return (
    <main id="main-content">
      <header className="relative isolate overflow-hidden border-b border-[var(--sf-color-border)] bg-[#151515] text-white">
        {page.heroMedia?.url ? (
          <StorefrontImage
            src={page.heroMedia.url}
            alt={page.heroMedia.altText ?? page.title}
            fill
            sizes="100vw"
            preload
            className="-z-20 object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_25%,#555_0,transparent_27%),radial-gradient(circle_at_82%_90%,#333_0,transparent_32%),linear-gradient(125deg,#090909,#202020_55%,#0d0d0d)]"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/20 to-black/25" />
        <div className="sf-container flex min-h-[58svh] items-end pb-12 pt-28 sm:min-h-[66svh] sm:pb-20">
          <div className="max-w-3xl">
            {breadcrumbs}
            {page.eyebrow ? (
              <p className="text-xs tracking-[0.16em] text-white/65">{page.eyebrow}</p>
            ) : null}
            <h1 className="mt-4 text-[clamp(2.8rem,7vw,6rem)] leading-[1.12] font-normal">
              {page.title}
            </h1>
            {page.subtitle ? (
              <p className="mt-6 max-w-2xl text-sm leading-8 text-white/75 sm:text-lg sm:leading-9">
                {toPersianDigits(page.subtitle)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-label="مسیرهای سریع پشتیبانی" className="sf-container py-12 sm:py-16">
        <div className="grid gap-px bg-[var(--sf-color-border)] md:grid-cols-3">
          {supportLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-52 flex-col justify-between bg-[var(--sf-color-canvas)] p-7 transition-colors hover:bg-[var(--sf-color-surface)] sm:p-9"
            >
              <p className="text-xs text-[var(--sf-color-subtle)]">{item.eyebrow}</p>
              <div className="mt-10">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-normal sm:text-2xl">{item.title}</h2>
                  <FiArrowLeft
                    aria-hidden="true"
                    className="shrink-0 transition-transform duration-300 group-hover:-translate-x-1"
                    size={19}
                  />
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--sf-color-muted)]">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="faq-list-title"
        className="sf-container pb-20 pt-4 sm:pb-28 sm:pt-10"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(15rem,0.65fr)_minmax(0,1.35fr)] lg:gap-20">
          <div>
            <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">راهنمای خرید</p>
            <h2 id="faq-list-title" className="mt-4 text-3xl font-normal sm:text-5xl">
              پاسخ پرسش‌های شما
            </h2>
            {page.body ? (
              <p className="mt-6 whitespace-pre-line text-sm leading-8 text-[var(--sf-color-muted)]">
                {toPersianDigits(page.body)}
              </p>
            ) : null}

            <label htmlFor="faq-search" className="mt-9 block text-xs text-[var(--sf-color-muted)]">
              جستجو در سوالات
            </label>
            <div className="relative mt-2">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--sf-color-muted)]"
                size={18}
              />
              <input
                id="faq-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="مثلاً پرداخت، ارسال یا مرجوعی"
                className="sf-form-control min-h-12 w-full border border-[var(--sf-color-border)] bg-transparent py-3 pr-11 pl-4 text-sm outline-none transition-colors placeholder:text-[var(--sf-color-subtle)] hover:border-[var(--sf-color-border-strong)] focus:border-[var(--sf-color-ink)]"
              />
            </div>
          </div>

          <div aria-live="polite" className="border-t border-[var(--sf-color-ink)]">
            {questions.length ? (
              questions.map((section, index) => {
                const questionKey = `${section.title}-${page.sections.indexOf(section)}`;
                const isOpen = openQuestion === questionKey;
                const panelId = `faq-answer-${page.sections.indexOf(section)}`;
                const buttonId = `faq-question-${page.sections.indexOf(section)}`;

                return (
                  <article key={questionKey} className="border-b border-[var(--sf-color-border)]">
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenQuestion(isOpen ? null : questionKey)}
                        className="flex w-full items-center justify-between gap-6 py-6 text-right sm:py-8"
                      >
                        <span className="flex gap-4 sm:gap-6">
                          <span className="text-xs text-[var(--sf-color-subtle)]">
                            {toPersianDigits(String(index + 1).padStart(2, '0'))}
                          </span>
                          <span className="text-sm font-medium leading-7 sm:text-base">
                            {toPersianDigits(section.title)}
                          </span>
                        </span>
                        {isOpen ? (
                          <FiMinus aria-hidden="true" className="shrink-0" size={18} />
                        ) : (
                          <FiPlus aria-hidden="true" className="shrink-0" size={18} />
                        )}
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!isOpen}
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                    >
                      <div className="overflow-hidden">
                        <p className="mr-8 max-w-2xl pb-7 text-sm leading-8 text-[var(--sf-color-muted)] sm:mr-12 sm:pb-9">
                          {toPersianDigits(
                            section.body ?? 'برای دریافت پاسخ با پشتیبانی تماس بگیرید.',
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="py-14 text-center">
                <p className="text-lg">پرسشی با این عبارت پیدا نشد.</p>
                <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
                  عبارت دیگری جستجو کنید یا با پشتیبانی در تماس باشید.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex border-b border-[var(--sf-color-ink)] pb-1 text-sm"
                >
                  تماس با پشتیبانی
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] py-14 sm:py-20">
        <div className="sf-container flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs text-[var(--sf-color-subtle)]">پاسخ را پیدا نکردید؟</p>
            <h2 className="mt-4 text-3xl font-normal sm:text-4xl">
              کارشناسان گالری همراه شما هستند.
            </h2>
          </div>
          <Link
            href="/contact"
            className="inline-flex min-h-12 w-fit items-center gap-3 border border-[var(--sf-color-ink)] px-6 text-sm transition-colors hover:bg-[var(--sf-color-ink)] hover:text-white"
          >
            ارتباط با پشتیبانی
            <FiArrowLeft aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
