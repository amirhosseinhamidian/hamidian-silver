'use client';

import { useEffect, useState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { buildAdminLoginPath } from '@/lib/auth/login-redirect';

function isProtectedAdminRequest(input: RequestInfo | URL): boolean {
  const rawUrl = input instanceof Request ? input.url : input.toString();

  try {
    const url = new URL(rawUrl, window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/api/auth/')
    );
  } catch {
    return false;
  }
}

function currentLoginPath(): string {
  return buildAdminLoginPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

export function AdminSessionMonitor() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const nativeFetch = window.fetch;
    const monitoredFetch: typeof window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      if (response.status === 401 && isProtectedAdminRequest(args[0])) setExpired(true);
      return response;
    };

    window.fetch = monitoredFetch;
    return () => {
      if (window.fetch === monitoredFetch) window.fetch = nativeFetch;
    };
  }, []);

  return (
    <Dialog open={expired}>
      <DialogContent
        size="sm"
        title="نشست مدیریتی منقضی شده است"
        description="برای حفظ امنیت، ادامه عملیات فقط پس از ورود دوباره امکان‌پذیر است."
        hideClose
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        footer={<ButtonLink href={expired ? currentLoginPath() : '/login'}>ورود دوباره</ButtonLink>}
      >
        <p className="text-sm leading-7 text-[var(--admin-color-muted)]">
          اطلاعات واردشده در فرم ممکن است ذخیره نشده باشد. پس از ورود، وضعیت عملیات را پیش از تکرار
          بررسی کنید.
        </p>
      </DialogContent>
    </Dialog>
  );
}
