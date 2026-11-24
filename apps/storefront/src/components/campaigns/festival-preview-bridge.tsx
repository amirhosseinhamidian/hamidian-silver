'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useRef, useState } from 'react';
import { FestivalLanding } from './festival-landing';
import { FestivalProducts } from './festival-products';

type Preview = components['schemas']['FestivalPreviewDto'];
type Device = 'mobile' | 'desktop';

function allowedAdmin(candidate: string, configured: string) {
  try {
    const origin = new URL(candidate).origin;
    if (origin !== candidate) return false;
    return (
      origin === new URL(configured).origin ||
      (process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
    );
  } catch {
    return false;
  }
}

function validNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}

function Frame({ nonce }: { nonce: string }) {
  const [data, setData] = useState<{ preview: Preview; initialSeconds: number } | null>(null);
  useEffect(() => {
    if (!validNonce(nonce) || window.parent === window) return;
    function receive(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.kind !== 'festival-preview-frame' ||
        event.data.nonce !== nonce
      )
        return;
      const preview = event.data.payload as Preview;
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

  if (!data) return <p className="p-6">در انتظار طرح جشنواره…</p>;
  const { preview, initialSeconds } = data;

  return (
    <div
      onClickCapture={(event) => {
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (link && !link.getAttribute('href')?.startsWith('#')) event.preventDefault();
      }}
    >
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

function Window({ adminOrigin, device }: { adminOrigin: string; device: Device }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [nonce, setNonce] = useState('');
  const [invalid, setInvalid] = useState(false);
  const target = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const data = useRef<Preview | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('nonce');
    const origin = params.get('admin');
    const opener = window.opener;
    if (!validNonce(token) || !origin || !allowedAdmin(origin, adminOrigin) || !opener) {
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
        event.data.kind === 'festival-preview'
      ) {
        const snapshot = event.data.payload as Preview;
        if (!snapshot?.design?.sections || !snapshot?.products?.items) return;
        data.current = snapshot;
        setPreview(snapshot);
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
    const timer = window.setTimeout(() => {
      setNonce(token);
      opener.postMessage({ kind: 'festival-preview-ready', nonce: token }, origin);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', receive);
    };
  }, [adminOrigin]);

  if (invalid) return <p className="p-6">پیش‌نمایش را از پنل کمپین باز کنید.</p>;
  if (!nonce) return <p className="p-6">در حال اتصال به پنل…</p>;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-3 bg-[var(--sf-color-surface)] p-3">
      <p role="status" className="text-sm">
        {preview
          ? `${preview.title} · پیش‌نمایش ${device === 'mobile' ? 'موبایل' : 'دسکتاپ'}`
          : 'در انتظار طرح جشنواره…'}
      </p>
      <div className="w-full overflow-x-auto">
        <iframe
          ref={target}
          name="festival-preview"
          title="طرح صفحهٔ جشنواره"
          src={`/campaign-preview?frame=1&nonce=${nonce}`}
          className={`mx-auto block h-[calc(100dvh-4rem)] rounded-sm border border-[var(--sf-color-border)] bg-white ${device === 'mobile' ? 'w-[390px]' : 'w-[1180px]'}`}
        />
      </div>
    </main>
  );
}

export function FestivalPreviewBridge({
  frame,
  device,
  frameNonce,
  adminOrigin,
}: {
  frame: boolean;
  device: Device;
  frameNonce: string;
  adminOrigin: string;
}) {
  return frame ? (
    <Frame nonce={frameNonce} />
  ) : (
    <Window adminOrigin={adminOrigin} device={device} />
  );
}
