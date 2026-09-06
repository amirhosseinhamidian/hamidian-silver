import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { getPaginationItems, Pagination } from '@/components/ui/pagination';

type Row = Readonly<{ id: string; title: string }>;

const columns: readonly DataTableColumn<Row>[] = [
  { id: 'title', header: 'عنوان', cell: (row) => row.title },
];

describe('admin operational patterns', () => {
  it('renders dense table data with an accessible caption', () => {
    render(
      <DataTable
        caption="فهرست سفارش‌ها"
        columns={columns}
        rows={[{ id: '1', title: 'سفارش اول' }]}
        getRowKey={(row) => row.id}
        compact
      />,
    );

    expect(screen.getByRole('table', { name: 'فهرست سفارش‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'سفارش اول' })).toBeInTheDocument();
  });

  it('shows a clear empty state instead of an empty table body', () => {
    render(
      <DataTable
        caption="فهرست خالی"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyTitle="سفارشی پیدا نشد"
      />,
    );

    expect(screen.getByText('سفارشی پیدا نشد')).toBeInTheDocument();
  });

  it('announces table loading and server errors', () => {
    const { rerender } = render(
      <DataTable
        caption="جدول وضعیت"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        loading
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('در حال بارگذاری اطلاعات');

    rerender(
      <DataTable
        caption="جدول وضعیت"
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        error={{ description: 'ارتباط با سرور برقرار نشد.' }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('ارتباط با سرور برقرار نشد.');
  });

  it('builds a bounded pagination range and marks the current page', () => {
    expect(getPaginationItems(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);

    render(
      <Pagination
        currentPage={5}
        totalPages={10}
        totalItems={100}
        pageSize={10}
        getPageHref={(page) => `?page=${page}`}
      />,
    );

    expect(screen.getByRole('link', { name: 'صفحه ۵' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('نمایش ۴۱ تا ۵۰ از ۱۰۰')).toBeInTheDocument();
  });

  it('announces active filters and keeps search labelled', () => {
    render(
      <FilterBar activeCount={2} resetAction={<button type="button">پاک‌کردن</button>}>
        <SearchField aria-label="جستجوی سفارش" />
      </FilterBar>,
    );

    expect(screen.getByRole('searchbox', { name: 'جستجوی سفارش' })).toBeInTheDocument();
    expect(screen.getByText('۲ فیلتر فعال')).toBeInTheDocument();
  });

  it('opens an accessible dialog and exposes its title', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>بازکردن</Button>
        </DialogTrigger>
        <DialogContent title="تأیید عملیات">جزئیات عملیات</DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'بازکردن' }));
    expect(screen.getByRole('dialog', { name: 'تأیید عملیات' })).toBeInTheDocument();
    expect(screen.getByText('جزئیات عملیات')).toBeInTheDocument();
  });

  it('opens row actions as a keyboard-friendly menu', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>عملیات</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>ویرایش سفارش</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'عملیات' }), { key: 'Enter' });
    expect(screen.getByRole('menuitem', { name: 'ویرایش سفارش' })).toBeInTheDocument();
  });
});
