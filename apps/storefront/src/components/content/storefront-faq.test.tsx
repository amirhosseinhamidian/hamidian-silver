import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontFaq } from '@/components/content/storefront-faq';
import type { PublicContentPage } from '@/lib/content/public-content-page';

const faqPage: PublicContentPage = {
  key: 'FAQ',
  title: 'سوالات متداول',
  eyebrow: 'راهنمای خرید',
  subtitle: 'پاسخ‌های روشن برای انتخاب و سفارش',
  body: 'پاسخ پرسش‌های رایج در 2 بخش',
  heroMedia: null,
  sections: [
    {
      title: 'چطور سایز مناسب را انتخاب کنم؟',
      body: 'اندازه‌گیری را دو بار انجام دهید.',
    },
    {
      title: 'آیا امکان مرجوع کردن محصول وجود دارد؟',
      body: 'فقط پس از بررسی پشتیبانی و تأیید ادمین امکان ثبت درخواست وجود دارد.',
    },
  ],
  seoTitle: null,
  seoDescription: null,
};

describe('StorefrontFaq', () => {
  it('searches configurable questions and expands an accessible answer', () => {
    render(<StorefrontFaq page={faqPage} />);

    expect(screen.getByRole('heading', { level: 1, name: 'سوالات متداول' })).toBeInTheDocument();
    expect(screen.getByText('پاسخ پرسش‌های رایج در ۲ بخش')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /راهنمای انتخاب سایز/ })).toHaveAttribute(
      'href',
      '/size-guide',
    );

    const returnQuestion = screen.getByRole('button', {
      name: /آیا امکان مرجوع کردن محصول وجود دارد؟/,
    });
    expect(returnQuestion).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(returnQuestion);
    expect(returnQuestion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/تأیید ادمین/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجو در سوالات' }), {
      target: { value: 'سایز' },
    });
    expect(
      screen.getByRole('button', { name: /چطور سایز مناسب را انتخاب کنم؟/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /آیا امکان مرجوع کردن محصول وجود دارد؟/ }),
    ).not.toBeInTheDocument();
  });

  it('offers support when no question matches the search', () => {
    render(<StorefrontFaq page={faqPage} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجو در سوالات' }), {
      target: { value: 'عبارت ناموجود' },
    });

    expect(screen.getByText('پرسشی با این عبارت پیدا نشد.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تماس با پشتیبانی' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });
});
