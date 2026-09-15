import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BottomSheet,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTrigger,
} from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { DataTableColumn } from '@/components/ui/data-table';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';

type Row = Readonly<{ id: string; title: string }>;

const columns: readonly DataTableColumn<Row>[] = [
  { id: 'title', header: 'عنوان', cell: (row) => row.title },
];

describe('admin mobile data patterns', () => {
  it('opens and closes the bottom sheet accessibly', async () => {
    render(
      <BottomSheet>
        <BottomSheetTrigger asChild>
          <Button>نمایش جزئیات</Button>
        </BottomSheetTrigger>
        <BottomSheetContent
          title="جزئیات سفارش"
          description="اطلاعات و عملیات سفارش انتخاب‌شده"
          footer={
            <BottomSheetClose asChild>
              <Button>بستن</Button>
            </BottomSheetClose>
          }
        >
          اطلاعات کامل سفارش
        </BottomSheetContent>
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'نمایش جزئیات' }));
    expect(screen.getByRole('dialog', { name: 'جزئیات سفارش' })).toHaveAccessibleDescription(
      'اطلاعات و عملیات سفارش انتخاب‌شده',
    );
    expect(screen.getByText('اطلاعات کامل سفارش')).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button', { name: 'بستن' });
    fireEvent.click(closeButtons.at(-1)!);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'جزئیات سفارش' })).not.toBeInTheDocument();
    });
  });

  it('keeps tables for tablet and cards for mobile', () => {
    render(
      <ResponsiveDataView
        mobileLabel="کارت‌های سفارش"
        renderMobileCard={(row) => <span>کارت {row.title}</span>}
        caption="جدول سفارش‌ها"
        columns={columns}
        rows={[{ id: '1', title: 'سفارش اول' }]}
        getRowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole('region', { name: 'کارت‌های سفارش' })).toHaveClass('md:hidden');
    const desktopContainer = screen.getByRole('table', { name: 'جدول سفارش‌ها' }).parentElement
      ?.parentElement?.parentElement;
    expect(desktopContainer).toHaveClass('hidden', 'md:block');
    expect(
      screen.getByRole('region', { name: 'جدول سفارش‌ها؛ جدول قابل پیمایش افقی' }),
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('list')).toContainElement(screen.getByText('کارت سفارش اول'));
    expect(screen.getByText('کارت سفارش اول')).toBeInTheDocument();
  });

  it('limits the card to key facts and exposes full details in a sheet', () => {
    render(
      <MobileDataCard
        eyebrow="سفارش ۱۰۰۱"
        title="مشتری نمونه"
        status="در حال پردازش"
        items={[
          { label: 'مبلغ', value: '۲ میلیون تومان' },
          { label: 'ارسال', value: 'پست پیشتاز' },
        ]}
        detailsTitle="سفارش ۱۰۰۱"
        details="تمام اطلاعات سفارش"
      />,
    );

    expect(screen.getByText('مشتری نمونه')).toBeInTheDocument();
    expect(screen.getByText('۲ میلیون تومان')).toBeInTheDocument();
    expect(screen.getByText('مشتری نمونه')).toHaveClass('break-words');
    expect(screen.getByText('۲ میلیون تومان')).toHaveClass('break-words');

    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    expect(screen.getByRole('dialog', { name: 'سفارش ۱۰۰۱' })).toHaveTextContent(
      'تمام اطلاعات سفارش',
    );
  });
});
