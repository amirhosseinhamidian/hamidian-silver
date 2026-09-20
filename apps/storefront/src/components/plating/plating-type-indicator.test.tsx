import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlatingTypeIndicator } from '@/components/plating/plating-type-indicator';

describe('PlatingTypeIndicator', () => {
  it.each([
    ['GOLD', 'آبکاری طلا', '#C9A227'],
    ['ROSE_GOLD', 'آبکاری رزگلد', '#B76E79'],
    ['RHODIUM', 'آبکاری رودیوم', '#C7CDD3'],
  ])('shows %s with its customer-facing color', (type, label, color) => {
    render(<PlatingTypeIndicator type={type} />);

    const indicator = screen.getByText(label).parentElement;
    expect(indicator).toHaveAttribute('data-plating-type', type);
    expect(indicator?.querySelector('[aria-hidden="true"]')).toHaveStyle({
      backgroundColor: color,
    });
  });
});
