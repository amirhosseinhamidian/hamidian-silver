import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontSizeGuide } from '@/components/content/storefront-size-guide';
import type { PublicContentPage } from '@/lib/content/public-content-page';

const sizeGuidePage: PublicContentPage = {
  key: 'SIZE_GUIDE',
  title: 'راهنمای انتخاب سایز',
  eyebrow: 'راهنمای خرید',
  subtitle: 'اندازه‌گیری دقیق برای یک انتخاب مطمئن',
  body: 'اندازه‌گیری را 2 بار انجام دهید.',
  heroMedia: null,
  heroMobileMedia: null,
  sections: [{ title: 'نکته اختصاصی', body: 'در پایان روز اندازه بگیرید.' }],
  seoTitle: null,
  seoDescription: null,
};

describe('StorefrontSizeGuide', () => {
  it('renders complete jewelry guidance, Persian measurements, and consultation', () => {
    render(<StorefrontSizeGuide page={sizeGuidePage} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'راهنمای انتخاب سایز' }),
    ).toBeInTheDocument();
    expect(screen.getByText('اندازه‌گیری را ۲ بار انجام دهید.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'اندازه انگشتر' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'اندازه دستبند' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'طول گردنبند' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /انگشتر روی خط‌کش با خط اندازه‌گیری/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('لبه داخلی تا لبه داخلی')).toBeInTheDocument();
    const ringTable = screen.getByRole('table', {
      name: 'جدول تبدیل قطر داخلی به سایز استاندارد انگشتر',
    });
    expect(within(ringTable).getByText('۳.۵')).toBeInTheDocument();
    expect(within(ringTable).getByText('۱۴.۴')).toBeInTheDocument();
    expect(within(ringTable).getByText('۱۳.۵')).toBeInTheDocument();
    expect(within(ringTable).getByText('۲۲.۶')).toBeInTheDocument();
    expect(within(ringTable).queryByText('محیط انگشت (میلی‌متر)')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دریافت مشاوره' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('heading', { name: 'نکته اختصاصی' })).toBeInTheDocument();
  });
});
