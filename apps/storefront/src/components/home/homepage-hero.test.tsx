import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomepageHero } from '@/components/home/homepage-hero';
import type { PublicHomepageHeroSlide } from '@/lib/home/public-homepage';

function slide(title: string, href = '/products'): PublicHomepageHeroSlide {
  return {
    title,
    subtitle: 'توضیح اسلاید',
    actionLabel: 'مشاهده',
    actionHref: href,
    media: {
      url: `https://media.test/${title}.webp`,
      mimeType: 'image/webp',
      altText: title,
      width: 1920,
      height: 1080,
    },
  };
}

describe('HomepageHero', () => {
  it('renders a single image without carousel controls', () => {
    render(<HomepageHero slides={[slide('اسلاید اول')]} label="هیرو" />);

    expect(screen.getByRole('region', { name: 'هیرو' })).not.toHaveAttribute(
      'aria-roledescription',
    );
    expect(screen.queryByRole('button', { name: 'اسلاید بعدی' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده' })).toHaveAttribute('href', '/products');
  });

  it('enables manual carousel controls only when multiple slides exist', () => {
    render(<HomepageHero slides={[slide('اسلاید اول'), slide('اسلاید دوم')]} label="هیرو" />);

    expect(screen.getByRole('region', { name: 'هیرو' })).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    );
    fireEvent.click(screen.getByRole('button', { name: 'اسلاید بعدی' }));
    expect(screen.getByRole('heading', { name: 'اسلاید دوم' })).toBeInTheDocument();
  });

  it('opens external actions safely in a new tab', () => {
    render(
      <HomepageHero
        slides={[slide('اسلاید خارجی', 'https://example.com/collection')]}
        label="هیرو"
      />,
    );

    const link = screen.getByRole('link', { name: 'مشاهده' });
    expect(link).toHaveAttribute('href', 'https://example.com/collection');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
