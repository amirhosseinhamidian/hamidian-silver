import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from '@/components/ui/money-input';
import { adminMoneyToWords, formatAdminMoneyInput } from '@/lib/presentation/formatters';

describe('MoneyInput', () => {
  it('groups digits and exposes the amount in Persian words', () => {
    const onChange = vi.fn();
    render(<MoneyInput id="price" aria-label="قیمت" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('قیمت'), { target: { value: '1350000' } });

    expect(screen.getByLabelText('قیمت')).toHaveValue('۱٬۳۵۰٬۰۰۰');
    expect(screen.getByText('به حروف: یک میلیون و سیصد و پنجاه هزار تومان')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('formats Persian and Arabic digits and converts zero', () => {
    expect(formatAdminMoneyInput('٠۱۲۳۴۵۶')).toBe('۱۲۳٬۴۵۶');
    expect(adminMoneyToWords(0)).toBe('صفر');
  });
});
