import { StorefrontShell } from '@/components/layout/storefront-shell';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('storefront test environment', () => {
  it('renders application-owned components in jsdom', () => {
    render(
      createElement(
        StorefrontShell,
        null,
        createElement('main', null, 'Storefront test environment'),
      ),
    );

    expect(screen.getByRole('main')).toHaveTextContent('Storefront test environment');
  });
});
