import { CatalogHero } from '@/components/catalog/catalog-hero';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const configuredSettings = {
  catalogHeroEnabled: true,
  catalogHeroTitle: 'کالکشن جدید',
  catalogHeroSubtitle: 'انتخاب‌های تازه نقره',
  catalogHeroMedia: {
    url: 'https://media.hamidian.test/catalog/hero.webp',
    altText: 'کالکشن نقره',
  },
};

describe('CatalogHero', () => {
  it('renders the configured public hero when it is enabled', () => {
    render(<CatalogHero settings={configuredSettings} />);

    expect(screen.getByRole('heading', { name: 'کالکشن جدید' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'کالکشن نقره' })).toHaveAttribute(
      'src',
      'https://media.hamidian.test/catalog/hero.webp',
    );
    expect(screen.getByText('انتخاب‌های تازه نقره')).toBeInTheDocument();
  });

  it('ignores configured media and copy when the hero is disabled', () => {
    render(
      <CatalogHero
        settings={{
          ...configuredSettings,
          catalogHeroEnabled: false,
        }}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'محصولات نقره حمیدیان' })).toBeInTheDocument();
    expect(screen.queryByText('انتخاب‌های تازه نقره')).not.toBeInTheDocument();
  });

  it('uses the development image only as a visual fallback', () => {
    render(
      <CatalogHero
        settings={{
          ...configuredSettings,
          catalogHeroEnabled: false,
        }}
        devFallbackSrc="/dev-catalog/hero.webp"
      />,
    );

    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/dev-catalog/hero.webp');
    expect(screen.getByRole('heading', { name: 'محصولات نقره حمیدیان' })).toBeInTheDocument();
  });
});
