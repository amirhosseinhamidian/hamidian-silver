'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  StorefrontHeader,
  type StorefrontNavigationCategory,
} from '@/components/layout/storefront-header';
import { FestivalLanding } from './festival-landing';
import { FestivalProducts } from './festival-products';

type Preview = components['schemas']['FestivalPreviewDto'];
const devices = {
  desktop: { width: 'w-[1280px]', label: 'دسکتاپ' },
  tablet: { width: 'w-[820px]', label: 'تبلت' },
  mobile: { width: 'w-[390px]', label: 'موبایل' },
  fullscreen: { width: 'w-full', label: 'تمام‌صفحه' },
} as const;
type Device = keyof typeof devices;

function validNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}

function isPreview(value: unknown): value is Preview {
  if (!value || typeof value !== 'object') return false;
  const preview = value as Partial<Preview>;
  return (
    typeof preview.title === 'string' &&
    typeof preview.story === 'string' &&
    typeof preview.slug === 'string' &&
    typeof preview.endsAt === 'string' &&
    Boolean(preview.design?.theme) &&
    Array.isArray(preview.design?.sections) &&
    Array.isArray(preview.products?.items)
  );
}

function preventNavigation(event: MouseEvent<HTMLDivElement>) {
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  if (link && !link.getAttribute('href')?.startsWith('#')) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function Frame({
  nonce,
  navigationCategories,
}: {
  nonce: string;
  navigationCategories: readonly StorefrontNavigationCategory[];
}) {
  const [data, setData] = useState<{ preview: Preview; initialSeconds: number } | null>(null);
  useEffect(() => {
    if (!validNonce(nonce) || window.parent === window) return;
    function receive(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.kind !== 'festival-preview-frame' ||
        event.data.nonce !== nonce ||
        !isPreview(event.data.payload)
      )
        return;
      const preview = event.data.payload;
      setData({
        preview,
        initialSeconds: Math.max(0, Math.ceil((Date.parse(preview.endsAt) - Date.now()) / 1000)),
      });
    }
    window.addEventListener('message', receive);
    window.parent.postMessage(
      { kind: 'festival-preview-frame-ready', nonce },
      window.location.origin,
    );
    return () => window.removeEventListener('message', receive);
  }, [nonce]);

  if (!data) return <p className="p-6">پیش‌نمایش را از پنل کمپین باز کنید.</p>;
  const { preview, initialSeconds } = data;
  return (
    <div
      onClickCapture={preventNavigation}
      onAuxClickCapture={preventNavigation}
      onContextMenuCapture={preventNavigation}
    >
      <StorefrontHeader
        preview
        campaignNavigation={preview.navigation}
        campaignCountdown={preview.announcement}
        navigationCategories={navigationCategories}
      />
      <FestivalLanding
        preview
        {...preview}
        initialSeconds={initialSeconds}
        pathname={`/campaigns/${preview.slug}`}
      >
        <FestivalProducts preview products={preview.products} slug={preview.slug} filters={{}} />
      </FestivalLanding>
    </div>
  );
}

function PreviewWindow({ adminOrigin }: { adminOrigin: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [nonce, setNonce] = useState('');
  const [invalid, setInvalid] = useState(false);
  const target = useRef<HTMLIFrameElement>(null);
  const windowContent = useRef<HTMLElement>(null);
  const ready = useRef(false);
  const data = useRef<Preview | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('nonce');
    const origin = params.get('admin');
    const opener = window.opener;
    if (!validNonce(token) || !origin || origin !== adminOrigin || !opener) {
      const timer = window.setTimeout(() => setInvalid(true), 0);
      return () => window.clearTimeout(timer);
    }

    function deliver() {
      if (!ready.current || !data.current) return;
      target.current?.contentWindow?.postMessage(
        { kind: 'festival-preview-frame', nonce: token, payload: data.current },
        window.location.origin,
      );
    }
    function receive(event: MessageEvent) {
      if (event.data?.nonce !== token) return;
      if (
        event.origin === origin &&
        event.source === opener &&
        event.data.kind === 'festival-preview' &&
        isPreview(event.data.payload)
      ) {
        data.current = event.data.payload;
        setPreview(event.data.payload);
        deliver();
      } else if (
        event.origin === window.location.origin &&
        event.source === target.current?.contentWindow &&
        event.data.kind === 'festival-preview-frame-ready'
      ) {
        ready.current = true;
        deliver();
      }
    }
    window.addEventListener('message', receive);
    const begin = window.setTimeout(() => {
      setNonce(token);
      opener.postMessage({ kind: 'festival-preview-ready', nonce: token }, origin);
    }, 0);
    return () => {
      window.clearTimeout(begin);
      window.removeEventListener('message', receive);
    };
  }, [adminOrigin]);

  function resize(next: Device) {
    setDevice(next);
    if (next === 'fullscreen' && !document.fullscreenElement) {
      void windowContent.current?.requestFullscreen?.().catch(() => undefined);
    } else if (next !== 'fullscreen' && document.fullscreenElement === windowContent.current) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  if (invalid) return <p className="p-6">پیش‌نمایش را از پنل کمپین باز کنید.</p>;
  if (!nonce) return <p className="p-6">در حال اتصال به پنل…</p>;
  return (
    <main
      ref={windowContent}
      className="flex h-dvh flex-col gap-3 bg-[var(--sf-color-surface)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm">
          پیش‌نمایش خصوصی · {preview?.title ?? 'در انتظار طرح جشنواره…'}
        </p>
        <div role="group" aria-label="اندازهٔ پیش‌نمایش" className="flex flex-wrap gap-1">
          {(Object.keys(devices) as Device[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === device}
              className="min-h-9 rounded border border-current px-2 text-sm aria-pressed:bg-[var(--sf-color-ink)] aria-pressed:text-[var(--sf-color-inverse)]"
              onClick={() => resize(option)}
            >
              {devices[option].label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <iframe
          ref={target}
          title="طرح صفحهٔ جشنواره"
          sandbox="allow-scripts allow-same-origin"
          src={`/campaign-preview?frame=1&nonce=${nonce}`}
          className={`mx-auto block h-full max-w-none rounded-sm border border-[var(--sf-color-border)] bg-white ${devices[device].width}`}
        />
      </div>
    </main>
  );
}

export function FestivalPreviewBridge({
  frame,
  frameNonce,
  adminOrigin,
  navigationCategories,
}: {
  frame: boolean;
  frameNonce: string;
  adminOrigin: string;
  navigationCategories: readonly StorefrontNavigationCategory[];
}) {
  return frame ? (
    <Frame nonce={frameNonce} navigationCategories={navigationCategories} />
  ) : (
    <PreviewWindow adminOrigin={adminOrigin} />
  );
}
