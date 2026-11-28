import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';

describe('Button', () => {
  it('disables interaction while loading without hiding its accessible label', () => {
    render(<Button loading>افزودن به سبد</Button>);

    const button = screen.getByRole('button', { name: 'افزودن به سبد' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.className).toContain('rounded-[var(--sf-radius-md)]');
    expect(button.className).toContain('sf-button-solid');
  });
});

describe('FormField', () => {
  it('connects labels, hints, and validation errors to the form control', () => {
    render(
      <FormField
        id="customer-name"
        label="نام"
        hint="نام و نام خانوادگی"
        error="وارد کردن نام الزامی است"
      >
        {(controlProps) => <Input {...controlProps} />}
      </FormField>,
    );

    const input = screen.getByLabelText('نام');

    expect(input).toHaveAttribute('aria-describedby', 'customer-name-hint customer-name-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('وارد کردن نام الزامی است');
  });
});

describe('Input', () => {
  it('maps the invalid state to accessible markup', () => {
    render(<Input aria-label="کد تخفیف" invalid />);

    expect(screen.getByLabelText('کد تخفیف')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Select', () => {
  it('renders the selected option through an accessible custom trigger', () => {
    render(
      <Select
        aria-label="مرتب‌سازی"
        defaultValue="newest"
        options={[
          { value: 'newest', label: 'جدیدترین‌ها' },
          { value: 'price-asc', label: 'کمترین قیمت' },
        ]}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'مرتب‌سازی' });
    expect(trigger).toHaveTextContent('جدیدترین‌ها');
    expect(trigger).toHaveClass('sf-select-trigger');
  });

  it('submits the empty option and restores the default on form reset', () => {
    const { container } = render(
      <form>
        <Select
          name="status"
          aria-label="فیلتر وضعیت"
          defaultValue="active"
          options={[
            { value: '', label: 'همه' },
            { value: 'active', label: 'فعال' },
            { value: 'blocked', label: 'مسدود', disabled: true },
          ]}
        />
      </form>,
    );
    const form = container.querySelector('form')!;
    const trigger = screen.getByRole('combobox', { name: 'فیلتر وضعیت' });
    expect(trigger).toHaveTextContent('فعال');
    expect(new FormData(form).getAll('status')).toEqual(['active']);

    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'مسدود' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'همه' }));
    expect(new FormData(form).getAll('status')).toEqual(['']);

    act(() => form.reset());
    expect(trigger).toHaveTextContent('فعال');
    expect(new FormData(form).getAll('status')).toEqual(['active']);
  });
});
