import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignDestinationPicker } from './campaign-destination-picker';

describe('CampaignDestinationPicker', () => {
  it('preserves parameters on an existing destination and posts edits under the original field name', () => {
    const { container } = render(
      <form>
        <CampaignDestinationPicker name="destination" defaultValue="/products?sort=newest&page=2" />
      </form>,
    );
    const form = container.querySelector('form')!;
    const path = screen.getByLabelText('مسیر عمومی مقصد');
    expect(path).toHaveValue('/products?sort=newest&page=2');
    expect(new FormData(form).getAll('destination')).toEqual(['/products?sort=newest&page=2']);
    fireEvent.change(path, { target: { value: '/guide' } });
    expect(new FormData(form).getAll('destination')).toEqual(['/guide']);
  });

  it('clears an optional banner destination without leaving the previous path in the submission', () => {
    const { container } = render(
      <form>
        <CampaignDestinationPicker name="ctaPath" defaultValue="/products" />
      </form>,
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('ctaPath')).toBe('/products');
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن مقصد' }));
    expect(new FormData(form).get('ctaPath')).toBe('');
  });
});
