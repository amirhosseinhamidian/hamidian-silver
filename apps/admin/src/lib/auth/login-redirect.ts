const ADMIN_ORIGIN = 'https://admin.local';

export function normalizeAdminReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\')) return '/';

  try {
    const url = new URL(value, ADMIN_ORIGIN);

    if (url.origin !== ADMIN_ORIGIN || url.pathname === '/login') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
