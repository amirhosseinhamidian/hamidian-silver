import {
  StorefrontFooter,
  type StorefrontFooterContent,
} from '@/components/layout/storefront-footer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const footerContent: StorefrontFooterContent = {
  galleryName: 'گالری نقره حمیدیان',
  about: 'گالری حمیدیان ارائه‌دهنده مجموعه‌ای منتخب از زیورآلات نقره است.',
  address: 'تهران، بازار بزرگ',
  phoneNumbers: ['02112345678', '09121234567'],
  email: 'hello@hamidian.shop',
  social: {
    instagram: 'https://instagram.com/hamidian',
    telegram: 'https://t.me/hamidian',
    bale: 'https://ble.ir/hamidian',
  },
};

describe('StorefrontFooter', () => {
  it('renders configured gallery information and social links', () => {
    render(<StorefrontFooter content={footerContent} />);

    expect(screen.getByText('درباره گالری نقره حمیدیان')).toBeInTheDocument();
    expect(
      screen.getByText('گالری حمیدیان ارائه‌دهنده مجموعه‌ای منتخب از زیورآلات نقره است.'),
    ).toBeInTheDocument();
    expect(screen.getByText('تهران، بازار بزرگ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '02112345678' })).toHaveAttribute(
      'href',
      'tel:02112345678',
    );
    expect(screen.getByRole('link', { name: 'hello@hamidian.shop' })).toHaveAttribute(
      'href',
      'mailto:hello@hamidian.shop',
    );
    expect(screen.getByRole('link', { name: 'اینستاگرام گالری حمیدیان' })).toHaveAttribute(
      'href',
      'https://instagram.com/hamidian',
    );
    expect(screen.getByRole('link', { name: 'تلگرام گالری حمیدیان' })).toHaveAttribute(
      'href',
      'https://t.me/hamidian',
    );
    expect(screen.getByRole('link', { name: 'بله گالری حمیدیان' })).toHaveAttribute(
      'href',
      'https://ble.ir/hamidian',
    );
  });

  it('hides optional gallery details when settings are unavailable', () => {
    render(<StorefrontFooter />);

    expect(screen.queryByText('ارتباط با گالری')).not.toBeInTheDocument();
    expect(screen.queryByText('شبکه‌های اجتماعی')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^درباره / })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'لینک‌های فروشگاه' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'اطلاعات گالری' })).toBeInTheDocument();
  });
});
