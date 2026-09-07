import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import type { PublicContentPage } from '@/lib/content/public-content-page';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

const aboutPage: PublicContentPage = {
  key: 'ABOUT',
  title: 'روایت نقره حمیدیان',
  eyebrow: 'درباره ما',
  subtitle: 'زیبایی ماندگار',
  body: 'بیش از 20 سال همراه شما هستیم.',
  heroMedia: {
    url: 'https://media.hamidian.test/about.webp',
    altText: 'زیورآلات نقره حمیدیان',
    width: 1920,
    height: 1080,
  },
  sections: [{ title: 'انتخاب دقیق', body: 'کیفیت در جزئیات شکل می‌گیرد.' }],
  seoTitle: null,
  seoDescription: null,
};

const settings: PublicSiteSettings = {
  catalogHeroEnabled: false,
  catalogHeroTitle: null,
  catalogHeroSubtitle: null,
  catalogHeroMedia: null,
  galleryName: 'نقره حمیدیان',
  footerAbout: null,
  contactAddress: 'تهران، پلاک 12',
  contactPhoneNumbers: ['02112345678'],
  contactEmail: 'hello@hamidian.test',
  instagramUrl: 'https://instagram.com/hamidian',
  telegramUrl: null,
  baleUrl: null,
};

describe('StorefrontContentPage', () => {
  it('renders the configured jewelry image and editorial content with Persian digits', () => {
    render(<StorefrontContentPage page={aboutPage} kind="about" />);

    expect(screen.getByRole('img', { name: 'زیورآلات نقره حمیدیان' })).toHaveAttribute(
      'src',
      'https://media.hamidian.test/about.webp',
    );
    expect(screen.getByRole('heading', { name: 'روایت نقره حمیدیان' })).toBeInTheDocument();
    expect(screen.getByText('بیش از ۲۰ سال همراه شما هستیم.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'انتخاب دقیق' })).toBeInTheDocument();
  });

  it('renders configured contact settings and keeps links actionable', () => {
    render(
      <StorefrontContentPage
        page={{ ...aboutPage, key: 'CONTACT', title: 'در تماس باشیم', sections: [] }}
        kind="contact"
        settings={settings}
      />,
    );

    expect(screen.getByText('تهران، پلاک ۱۲')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '۰۲۱۱۲۳۴۵۶۷۸' })).toHaveAttribute(
      'href',
      'tel:02112345678',
    );
    expect(screen.getByRole('link', { name: 'اینستاگرام' })).toHaveAttribute(
      'href',
      'https://instagram.com/hamidian',
    );
  });
});
