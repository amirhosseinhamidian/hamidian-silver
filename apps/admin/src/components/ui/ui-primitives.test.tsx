import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Alert } from './alert';
import { Badge } from './badge';
import { Button, IconButton } from './button';
import { Input } from './form-control';
import { FormField } from './form-field';
import { Select } from './select';

describe('admin UI primitives', () => {
  it('prevents repeated actions while a button is loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        ذخیره
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'ذخیره' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('requires an accessible label for icon-only actions', () => {
    render(<IconButton label="بستن">×</IconButton>);
    expect(screen.getByRole('button', { name: 'بستن' })).toBeInTheDocument();
  });

  it('connects field errors to their controls', () => {
    render(
      <FormField id="sku" label="شناسه کالا" error="شناسه تکراری است" required>
        {(props) => <Input {...props} />}
      </FormField>,
    );
    const input = screen.getByLabelText(/شناسه کالا/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('شناسه تکراری است');
  });

  it('renders an accessible custom select', () => {
    render(
      <Select
        aria-label="وضعیت"
        defaultValue="active"
        options={[{ value: 'active', label: 'فعال' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'وضعیت' })).toHaveTextContent('فعال');
  });

  it('pairs operational colors with readable status text', () => {
    render(
      <>
        <Badge tone="danger">اقدام فوری</Badge>
        <Alert tone="warning">موجودی رو به اتمام است.</Alert>
      </>,
    );
    expect(screen.getByText('اقدام فوری')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('موجودی رو به اتمام است.');
  });
});
