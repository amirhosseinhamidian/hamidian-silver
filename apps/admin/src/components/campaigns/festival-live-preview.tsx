'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';

type Draft = components['schemas']['FestivalPreviewDraftDto'];
type Preview = components['schemas']['FestivalPreviewDto'];
type Viewer = { popup: Window; send: (payload: Preview) => void; dispose: () => void };

export function FestivalLivePreview({
  campaignId,
  draft,
}: {
  campaignId: string;
  draft: Draft | null;
}) {
  const viewer = useRef<Viewer | null>(null);
  const [connectionVersion, setConnectionVersion] = useState(0);
  const connected = connectionVersion > 0;
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const body = draft ? JSON.stringify(draft) : null;

  useEffect(() => () => viewer.current?.dispose(), []);

  function open() {
    if (viewer.current && !viewer.current.popup.closed) {
      viewer.current.popup.focus();
      return;
    }
    viewer.current?.dispose();
    setConnectionVersion(0);
    setError(null);
    const url = new URL(
      '/campaign-preview',
      process.env.NEXT_PUBLIC_STOREFRONT_URL ||
        (process.env.NODE_ENV === 'development'
          ? 'http://localhost:3001'
          : 'https://hamidian.shop'),
    );
    const nonce = crypto.randomUUID();
    url.hash = new URLSearchParams({ nonce, admin: window.location.origin }).toString();
    const popup = window.open(url.href, '_blank', 'popup,width=1320,height=900');
    if (!popup) {
      setError('برای باز کردن پیش‌نمایش، پنجرهٔ جدید را در مرورگر مجاز کنید.');
      return;
    }
    const target = popup;
    const connectionTimeout = window.setTimeout(() => {
      if (viewer.current?.popup !== target) return;
      viewer.current.dispose();
      viewer.current = null;
      setError('اتصال به پیش‌نمایش ممکن نشد. نشانی فروشگاه و پنل را بررسی کنید.');
    }, 15_000);
    const closeCheck = window.setInterval(() => {
      if (!target.closed || viewer.current?.popup !== target) return;
      viewer.current.dispose();
      viewer.current = null;
      setConnectionVersion(0);
      setUpdating(false);
    }, 1_000);

    function receive(event: MessageEvent) {
      if (
        event.origin !== url.origin ||
        event.source !== target ||
        event.data?.nonce !== nonce ||
        event.data?.kind !== 'festival-preview-ready'
      )
        return;
      window.clearTimeout(connectionTimeout);
      setConnectionVersion((version) => version + 1);
    }
    window.addEventListener('message', receive);
    viewer.current = {
      popup: target,
      send: (payload) =>
        target.postMessage({ kind: 'festival-preview', nonce, payload }, url.origin),
      dispose: () => {
        window.clearTimeout(connectionTimeout);
        window.clearInterval(closeCheck);
        window.removeEventListener('message', receive);
        target.close();
      },
    };
  }

  useEffect(() => {
    const target = viewer.current;
    if (!connectionVersion || !target || !body) return;
    const controller = new AbortController();
    const delay = window.setTimeout(async () => {
      setUpdating(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/design/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(await campaignError(response));
        const data = (await response.json()) as Preview;
        if (!controller.signal.aborted && viewer.current === target && !target.popup.closed)
          target.send(data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'دریافت پیش‌نمایش انجام نشد.');
      } finally {
        if (!controller.signal.aborted) setUpdating(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(delay);
      controller.abort();
    };
  }, [body, campaignId, connectionVersion]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={open}>
        باز کردن پیش‌نمایش زنده
      </Button>
      <p role="status" className="text-xs text-[var(--admin-color-muted)]">
        {!body
          ? 'پس از تکمیل فیلدها و بارگذاری رسانه، پیش‌نمایش به‌روز می‌شود.'
          : connected && updating
            ? 'در حال به‌روزرسانی پیش‌نمایش…'
            : connected
              ? 'پیش‌نمایش متصل است.'
              : 'تغییرات فرم در پنجرهٔ پیش‌نمایش دیده می‌شوند.'}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
