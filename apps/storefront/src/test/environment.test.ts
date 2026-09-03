import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('storefront test environment', () => {
  it('renders React content in jsdom', () => {
    render(createElement('h1', null, 'Storefront test environment'));

    expect(
      screen.getByRole('heading', { name: 'Storefront test environment' }),
    ).toBeInTheDocument();
  });
});
