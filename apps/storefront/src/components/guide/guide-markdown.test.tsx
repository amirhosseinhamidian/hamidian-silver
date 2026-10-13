import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuideMarkdown } from '@/components/guide/guide-markdown';

describe('GuideMarkdown', () => {
  it('renders Persian formatting, lists, safe links and subheadings', () => {
    render(
      <GuideMarkdown
        markdown={[
          '### زیرعنوان',
          '',
          'متن **مهم** و *تأکیدی* با [راهنما](/size-guide) و `Ag 925`.',
          '',
          '1. مورد اول',
          '2. مورد دوم',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'زیرعنوان' })).toBeInTheDocument();
    expect(screen.getByText('مهم').closest('strong')).not.toBeNull();
    expect(screen.getByText('تأکیدی').closest('em')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'راهنما' })).toHaveAttribute('href', '/size-guide');
    expect(screen.getByText('Ag 925').tagName).toBe('CODE');
    expect(screen.getByRole('list')).toHaveClass('list-decimal');
  });

  it('never creates executable HTML or dangerous protocol links', () => {
    const { container } = render(
      <GuideMarkdown markdown={'<script>alert(1)</script> [خطر](javascript:alert(1))'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'خطر' })).not.toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });
});
