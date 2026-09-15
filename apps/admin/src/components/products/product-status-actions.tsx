'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ProductStatus } from '@/lib/catalog/catalog-model';

type ProductStatusActionsProps = Readonly<{
  productId: string;
  productName: string;
  status: ProductStatus;
  stacked?: boolean;
}>;

function errorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return value.message;
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return nested.message;
  }
  return 'تغییر وضعیت محصول انجام نشد. دوباره تلاش کنید.';
}

export function ProductStatusActions({
  productId,
  productName,
  status,
  stacked = false,
}: ProductStatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ProductStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(nextStatus: ProductStatus) {
    if (
      nextStatus === 'ARCHIVED' &&
      !window.confirm(`محصول «${productName}» آرشیو شود؟ انتشار آن در فروشگاه متوقف خواهد شد.`)
    ) {
      return;
    }

    setPending(nextStatus);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/products/${productId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(errorMessage(payload));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : errorMessage(null));
    } finally {
      setPending(null);
    }
  }

  const primaryStatus: ProductStatus = status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
  const primaryLabel = status === 'ACTIVE' ? 'تبدیل به پیش‌نویس' : 'انتشار محصول';

  return (
    <div className={stacked ? 'space-y-2' : 'flex flex-wrap items-center justify-end gap-2'}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className={stacked ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
        <Button
          size="sm"
          variant={status === 'ACTIVE' ? 'outline' : 'primary'}
          loading={pending === primaryStatus}
          disabled={pending !== null}
          onClick={() => void changeStatus(primaryStatus)}
        >
          {primaryLabel}
        </Button>
        {status !== 'ARCHIVED' ? (
          <Button
            size="sm"
            variant="danger"
            loading={pending === 'ARCHIVED'}
            disabled={pending !== null}
            onClick={() => void changeStatus('ARCHIVED')}
          >
            آرشیو
          </Button>
        ) : null}
      </div>
    </div>
  );
}
