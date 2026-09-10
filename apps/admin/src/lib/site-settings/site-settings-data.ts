import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseAdminHomepageSettings,
  parseAdminSiteSettings,
  parseCategoryReferences,
  parseCountryReferences,
  parseProductReferences,
  type AdminHomepageSettings,
  type AdminSiteSettings,
  type SiteSettingsReference,
} from '@/lib/site-settings/site-settings-model';

export type SiteSettingsData = Readonly<{
  settings: AdminSiteSettings | null;
  homepage: AdminHomepageSettings | null;
  categories: readonly SiteSettingsReference[];
  products: readonly SiteSettingsReference[];
  countries: readonly SiteSettingsReference[];
  failed: boolean;
}>;

async function load<T>(
  path: string,
  token: string,
  parse: (value: unknown) => T | null,
): Promise<T | null> {
  try {
    const response = await requestAdminCatalog(path, token);
    if (!response.ok) return null;
    return parse(await readJsonResponse(response));
  } catch {
    return null;
  }
}

export async function loadSiteSettingsData(): Promise<SiteSettingsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  const [settings, homepage, categories, products, countries] = await Promise.all([
    load('/api/v1/site-settings', token, parseAdminSiteSettings),
    load('/api/v1/site-settings/homepage', token, parseAdminHomepageSettings),
    load('/api/v1/catalog/public/categories', token, parseCategoryReferences),
    load(
      '/api/v1/catalog/public/products?page=1&pageSize=48&sort=newest',
      token,
      parseProductReferences,
    ),
    load('/api/v1/catalog/countries', token, parseCountryReferences),
  ]);

  return {
    settings,
    homepage,
    categories: categories ?? [],
    products: products ?? [],
    countries: countries ?? [],
    failed: !settings || !homepage || !categories || !products || !countries,
  };
}
