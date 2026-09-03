import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/form-control';

describe('Button', () => {
  it('disables interaction while loading without hiding its accessible label', () => {
    render(<Button loading>افزودن به سبد</Button>);

    const button = screen.getByRole('button', { name: 'افزودن به سبد' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
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
