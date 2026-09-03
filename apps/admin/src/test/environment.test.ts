import { AdminShell } from '@/components/layout/admin-shell';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('admin test environment', () => {
  it('renders application-owned components in jsdom', () => {
    render(createElement(AdminShell, null, createElement('main', null, 'Admin test environment')));

    expect(screen.getByRole('main')).toHaveTextContent('Admin test environment');
  });
});
