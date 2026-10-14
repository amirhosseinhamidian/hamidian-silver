import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuideTableOfContents } from '@/components/guide/guide-table-of-contents';

describe('GuideTableOfContents', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('smoothly scrolls to the selected article section', () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement('section');
    target.id = 'silver-care';
    target.scrollIntoView = scrollIntoView;
    document.body.append(target);

    render(<GuideTableOfContents items={[{ anchor: 'silver-care', heading: 'نگهداری نقره' }]} />);

    fireEvent.click(screen.getByRole('link', { name: 'نگهداری نقره' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.hash).toBe('#silver-care');
  });
});
