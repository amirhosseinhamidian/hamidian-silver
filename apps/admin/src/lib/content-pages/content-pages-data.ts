import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseAdminContentPages,
  type AdminContentPage,
} from '@/lib/content-pages/content-pages-model';

export type ContentPagesData = Readonly<{
  pages: readonly AdminContentPage[];
  failed: boolean;
}>;

export async function loadContentPages(): Promise<ContentPagesData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/site-settings/pages', token);
    if (!response.ok) return { pages: [], failed: true };
    const pages = parseAdminContentPages(await readJsonResponse(response));
    return pages ? { pages, failed: false } : { pages: [], failed: true };
  } catch {
    return { pages: [], failed: true };
  }
}
