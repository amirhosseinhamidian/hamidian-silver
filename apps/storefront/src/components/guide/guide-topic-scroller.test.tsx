import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GuideTopicScroller } from '@/components/guide/guide-topic-scroller';

const items = [
  { id: 'all', label: 'همه دانستنی‌ها', href: '/guide#guide-results', current: true },
  {
    id: 'silver',
    label: 'شناخت نقره',
    href: '/guide?topic=silver#guide-results',
    current: false,
  },
  {
    id: 'care',
    label: 'نگهداری',
    href: '/guide?topic=care#guide-results',
    current: false,
  },
];

describe('GuideTopicScroller', () => {
  it('keeps result anchors on links and moves exactly one topic per control click', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<GuideTopicScroller items={items} />);

    expect(screen.getByRole('link', { name: 'شناخت نقره' })).toHaveAttribute(
      'href',
      '/guide?topic=silver#guide-results',
    );
    expect(screen.getByRole('button', { name: 'موضوع قبلی' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'موضوع بعدی' }));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    expect(screen.getByRole('button', { name: 'موضوع قبلی' })).toBeEnabled();
  });
});
