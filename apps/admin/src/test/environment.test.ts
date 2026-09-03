import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('admin test environment', () => {
  it('renders React content in jsdom', () => {
    render(createElement('h1', null, 'Admin test environment'));

    expect(screen.getByRole('heading', { name: 'Admin test environment' })).toBeInTheDocument();
  });
});
