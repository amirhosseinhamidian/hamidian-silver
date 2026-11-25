import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualCalendarPicker } from './dual-calendar-picker';

describe('DualCalendarPicker', () => {
  it('keeps the selected instant when switching calendars and posts Tehran wall time', () => {
    const { container } = render(
      <form>
        <DualCalendarPicker label="زمان آغاز" name="startsTehran" defaultValue="1403/01/01 00:15" />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'زمان آغاز' }));
    expect(screen.getByRole('button', { name: '۱ فروردین' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'تقویم' }), {
      target: { value: 'gregory' },
    });
    const selected = screen.getByRole('button', { name: '۲۰ مارس' });
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: '۱۹ مارس' })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'ساعت' })).toHaveValue('00');
    expect(screen.getByRole('combobox', { name: 'دقیقه' })).toHaveValue('15');
    fireEvent.click(screen.getByRole('button', { name: 'تأیید انتخاب' }));
    expect(new FormData(container.querySelector('form')!).get('startsTehran')).toBe(
      '1403/01/01 00:15',
    );
  });

  it('selects a report day without a time and lets an optional field be cleared', () => {
    const { container } = render(
      <form>
        <DualCalendarPicker kind="date" label="روز پایان" name="to" defaultValue="2024-03-20" />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'روز پایان' }));
    expect(screen.queryByRole('combobox', { name: 'ساعت' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '۲ فروردین' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید انتخاب' }));
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('to')).toBe('2024-03-21');
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن روز پایان' }));
    expect(new FormData(form).get('to')).toBe('');
  });
});
