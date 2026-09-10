import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteSettingsView } from '@/components/site-settings/site-settings-view';
import type { SiteSettingsData } from '@/lib/site-settings/site-settings-data';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const data: SiteSettingsData = {
  failed: false,
  categories: [
    { id: 'category-1', label: 'انگشتر' },
    { id: 'category-2', label: 'گردنبند' },
  ],
  products: [
    { id: 'product-1', label: 'انگشتر مهتاب' },
    { id: 'product-2', label: 'گردنبند آوین' },
  ],
  countries: [
    { id: 'country-1', label: 'ایران' },
    { id: 'country-2', label: 'ایتالیا' },
    { id: 'country-3', label: 'ترکیه' },
    { id: 'country-4', label: 'تایلند' },
  ],
  settings: {
    headerCategoryIds: ['category-1'],
    announcement: {
      enabled: true,
      message: 'ارسال رایگان',
      countdownMode: 'NONE',
      durationSeconds: null,
      endsAt: null,
      ctaLabel: null,
      ctaHref: null,
    },
    catalogHeroEnabled: false,
    catalogHeroTitle: null,
    catalogHeroSubtitle: null,
    catalogHeroMediaId: null,
    catalogHeroMedia: null,
    galleryName: 'گالری نقره حمیدیان',
    footerAbout: null,
    contactAddress: 'تهران',
    contactPhoneNumbers: ['02112345678'],
    contactEmail: 'hello@example.com',
    instagramUrl: null,
    telegramUrl: null,
    baleUrl: null,
    seoSiteName: 'نقره حمیدیان',
    seoDefaultTitle: 'فروشگاه نقره حمیدیان',
    seoTitleTemplate: '%s | نقره حمیدیان',
    seoDefaultDescription: 'خرید آنلاین زیورآلات نقره',
    seoDefaultOgMediaId: null,
    seoDefaultOgMedia: null,
    seoOrganizationName: 'گالری نقره حمیدیان',
    seoOrganizationLogoMediaId: null,
    seoOrganizationLogoMedia: null,
    seoSocialProfileUrls: [],
    seoHomeTitle: null,
    seoHomeDescription: null,
    seoHomeOgMediaId: null,
    seoHomeOgMedia: null,
    updatedAt: '2026-09-08T12:00:00.000Z',
  },
  homepage: {
    primaryHeroSlides: [],
    secondaryHero: null,
    categoryIds: ['category-1'],
    popularProductIds: ['product-1'],
    manufacturerCountriesEnabled: false,
    manufacturerCountryIds: [],
    updatedAt: null,
  },
};

describe('SiteSettingsView', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('organizes homepage, header and footer settings in accessible tabs', () => {
    render(<SiteSettingsView data={data} canWrite />);

    expect(screen.getByRole('tab', { name: 'صفحه اصلی و Hero' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Hero اصلی صفحه خانه')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'افزودن به محصولات محبوب' })).toHaveClass(
      'admin-select-trigger',
    );
    expect(screen.getByRole('combobox', { name: 'افزودن به محصولات محبوب' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'افزودن به کشورهای منتخب صفحه اصلی' })).toHaveClass(
      'admin-select-trigger',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'هدر و اعلان' }));
    expect(screen.getByLabelText(/^متن اعلان/)).toHaveValue('ارسال رایگان');
    expect(screen.getByText('پیمایش دسته‌بندی‌ها')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'فوتر و تماس' }));
    expect(screen.getByLabelText('نام گالری')).toHaveValue('گالری نقره حمیدیان');
    expect(screen.getByLabelText('شماره تماس ۱')).toHaveValue('۰۲۱۱۲۳۴۵۶۷۸');
  });

  it('saves header and announcement changes through the protected BFF', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: '2026-09-08T13:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<SiteSettingsView data={data} canWrite />);
    fireEvent.click(screen.getByRole('tab', { name: 'هدر و اعلان' }));
    fireEvent.change(screen.getByLabelText(/^متن اعلان/), {
      target: { value: 'ارسال رایگان امروز' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره هدر و اعلان' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site-settings',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      headerCategoryIds: ['category-1'],
      announcement: { message: 'ارسال رایگان امروز' },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('edits up to five contact phones and omits empty or duplicate values on save', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: '2026-09-08T13:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<SiteSettingsView data={data} canWrite />);
    fireEvent.click(screen.getByRole('tab', { name: 'فوتر و تماس' }));

    fireEvent.click(screen.getByRole('button', { name: 'افزودن شماره تماس' }));
    fireEvent.change(screen.getByLabelText('شماره تماس ۲'), {
      target: { value: '۰۹۱۲۳۴۵۶۷۸۹' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شماره تماس' }));
    fireEvent.change(screen.getByLabelText('شماره تماس ۳'), {
      target: { value: '۰۹۱۲۳۴۵۶۷۸۹' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شماره تماس' }));
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شماره تماس' }));
    expect(screen.getByRole('button', { name: 'افزودن شماره تماس' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره فوتر و تماس' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      contactPhoneNumbers: ['02112345678', '09123456789'],
    });
  });

  it('keeps all settings read-only without settings.write', () => {
    render(<SiteSettingsView data={data} canWrite={false} />);

    expect(screen.getByText(/دسترسی شما فقط‌خواندنی است/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیره تنظیمات صفحه اصلی' })).toBeDisabled();
  });

  it('prevents enabling manufacturer countries with fewer than four selections', () => {
    render(<SiteSettingsView data={data} canWrite />);

    fireEvent.click(screen.getByLabelText('نمایش سکشن کشورهای سازنده'));
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تنظیمات صفحه اصلی' }));

    expect(screen.getByText(/حداقل چهار کشور انتخاب کنید/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
