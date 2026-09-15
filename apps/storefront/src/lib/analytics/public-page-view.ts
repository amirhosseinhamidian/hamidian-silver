// Only static, public routes are eligible. Never send URL query strings,
// private paths, untrusted slugs or document titles to an analytics vendor.
const PUBLIC_PAGES: Readonly<Record<string, string>> = {
  '/': 'خانه',
  '/products': 'محصولات',
  '/brands': 'برندها',
  '/about': 'درباره ما',
  '/contact': 'تماس با ما',
  '/faq': 'پرسش‌های متداول',
  '/privacy': 'حریم خصوصی',
  '/terms': 'قوانین',
  '/services': 'خدمات',
  '/size-guide': 'راهنمای اندازه',
};

export function publicPageView(pathname: string, origin: string) {
  if (!Object.hasOwn(PUBLIC_PAGES, pathname) || !/^https:\/\/[^/?#]+$/.test(origin)) {
    return null;
  }

  return {
    page_location: `${origin}${pathname}`,
    page_path: pathname,
    page_title: PUBLIC_PAGES[pathname],
    page_referrer: '',
  };
}
