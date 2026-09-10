'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiBell, FiCheck } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { AUTHENTICATION_SUCCEEDED_EVENT, openAuthModal } from '@/lib/auth/events';

type StockNotificationButtonProps = Readonly<{
  productId: string;
  variantId?: string;
  className?: string;
}>;

function subscriptionSyncEvent(productId: string, variantId?: string): string {
  return `hamidian:stock-notification-subscribed:${productId}:${variantId ?? 'product'}`;
}

export function StockNotificationButton({
  productId,
  variantId,
  className,
}: StockNotificationButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const subscribeAfterAuthentication = useRef(false);
  const syncEvent = subscriptionSyncEvent(productId, variantId);

  const subscribe = useCallback(async () => {
    if (status === 'loading' || status === 'subscribed') return;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/stock-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ...(variantId ? { variantId } : {}) }),
      });

      if (response.status === 401) {
        subscribeAfterAuthentication.current = true;
        setStatus('idle');
        openAuthModal();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;

        if (payload?.error?.code === 'STOCK_ALREADY_AVAILABLE') {
          setError('این گزینه همین حالا موجود است؛ صفحه را تازه‌سازی کنید.');
        } else {
          setError('ثبت درخواست انجام نشد؛ دوباره تلاش کنید.');
        }
        setStatus('idle');
        return;
      }

      subscribeAfterAuthentication.current = false;
      setStatus('subscribed');
      window.dispatchEvent(new Event(syncEvent));
    } catch {
      setError('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.');
      setStatus('idle');
    }
  }, [productId, status, syncEvent, variantId]);

  useEffect(() => {
    function retryAfterAuthentication() {
      if (subscribeAfterAuthentication.current) {
        subscribeAfterAuthentication.current = false;
        void subscribe();
      }
    }

    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, retryAfterAuthentication);
    return () =>
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, retryAfterAuthentication);
  }, [subscribe]);

  useEffect(() => {
    function syncSubscribedState() {
      setStatus('subscribed');
      setError(null);
    }

    window.addEventListener(syncEvent, syncSubscribedState);
    return () => window.removeEventListener(syncEvent, syncSubscribedState);
  }, [syncEvent]);

  return (
    <div className={className}>
      <Button
        type="button"
        size="lg"
        variant="outline"
        loading={status === 'loading'}
        disabled={status === 'subscribed'}
        onClick={() => void subscribe()}
        className="w-full gap-2"
      >
        {status === 'subscribed' ? (
          <>
            <FiCheck aria-hidden="true" size={18} />
            درخواست اطلاع‌رسانی ثبت شد
          </>
        ) : (
          <>
            <FiBell aria-hidden="true" size={18} />
            اگر موجود شد خبرم کن
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-xs leading-5 text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
