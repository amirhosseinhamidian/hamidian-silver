'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  PAYMENT_GATEWAY_METADATA,
  parsePaymentGatewaySettings,
  type AdminPaymentGatewayProvider,
  type AdminPaymentGatewaySetting,
} from '@/lib/payment-gateways/payment-gateway-model';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';

type PaymentGatewaySettingsViewProps = Readonly<{
  initialSettings: readonly AdminPaymentGatewaySetting[] | null;
  failed: boolean;
  canWrite: boolean;
}>;

type GatewayState = Readonly<{
  label: string;
  tone: BadgeTone;
  description: string;
}>;

function gatewayState(setting: AdminPaymentGatewaySetting): GatewayState {
  if (!setting.isImplemented) {
    return {
      label: 'پیاده‌سازی‌نشده',
      tone: 'neutral',
      description: 'adapter این درگاه در سرویس پرداخت فعال نیست.',
    };
  }
  if (setting.isAvailable) {
    return {
      label: 'آماده پرداخت',
      tone: 'success',
      description: 'درگاه پیکربندی و فعال است و به مشتری نمایش داده می‌شود.',
    };
  }
  if (setting.isEnabled && !setting.isConfigured) {
    return {
      label: 'فعال اما ناقص',
      tone: 'danger',
      description: 'درگاه فعال شده اما credential لازم روی سرور وجود ندارد.',
    };
  }
  if (setting.isConfigured) {
    return {
      label: 'آماده فعال‌سازی',
      tone: 'warning',
      description: 'تنظیمات سرور کامل است؛ برای نمایش در checkout درگاه را فعال کنید.',
    };
  }
  return {
    label: 'نیازمند پیکربندی',
    tone: 'neutral',
    description: 'ابتدا متغیرهای محیطی لازم را روی API تنظیم و سرویس را restart کنید.',
  };
}

function apiError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return nested.message;
  }
  return 'تغییر وضعیت درگاه انجام نشد. دوباره تلاش کنید.';
}

function GatewayCard({
  setting,
  canWrite,
  pending,
  onToggle,
}: Readonly<{
  setting: AdminPaymentGatewaySetting;
  canWrite: boolean;
  pending: boolean;
  onToggle: (provider: AdminPaymentGatewayProvider) => void;
}>) {
  const state = gatewayState(setting);
  const metadata = PAYMENT_GATEWAY_METADATA[setting.provider];
  const canEnable = setting.isImplemented && setting.isConfigured;
  const actionDisabled = pending || (!setting.isEnabled && !canEnable);
  const actionLabel = setting.isEnabled
    ? `غیرفعال‌کردن ${setting.displayName}`
    : `فعال‌کردن ${setting.displayName}`;

  return (
    <Card
      className="h-full"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{setting.displayName}</span>
          <Badge tone={state.tone} dot>
            {state.label}
          </Badge>
        </span>
      }
      description={metadata.description}
    >
      <div className="flex h-full flex-col gap-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--admin-color-muted)]">adapter پرداخت</dt>
            <dd className="mt-1 font-bold">{setting.isImplemented ? 'آماده' : 'در دسترس نیست'}</dd>
          </div>
          <div className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--admin-color-muted)]">credential سرور</dt>
            <dd className="mt-1 font-bold">{setting.isConfigured ? 'کامل' : 'ناقص'}</dd>
          </div>
        </dl>

        <div>
          <p className="text-xs font-bold text-[var(--admin-color-muted)]">متغیرهای محیطی لازم</p>
          <div className="mt-2 flex flex-wrap gap-2" dir="ltr">
            {metadata.credentialKeys.map((key) => (
              <code
                key={key}
                className="rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] px-2 py-1 text-xs"
              >
                {key}
              </code>
            ))}
          </div>
        </div>

        <p className="text-xs leading-6 text-[var(--admin-color-muted)]">{state.description}</p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-[var(--admin-color-border)] pt-4">
          <div>
            <p className="text-xs text-[var(--admin-color-muted)]">آخرین تغییر</p>
            <p className="mt-1 text-sm font-medium">
              {setting.updatedAt ? formatAdminDateTime(setting.updatedAt) : 'هنوز ثبت نشده'}
            </p>
          </div>
          {canWrite ? (
            <Button
              variant={setting.isEnabled ? 'outline' : 'primary'}
              onClick={() => onToggle(setting.provider)}
              disabled={actionDisabled}
              loading={pending}
              aria-label={actionLabel}
            >
              {setting.isEnabled ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
            </Button>
          ) : (
            <Badge tone="neutral">فقط مشاهده</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PaymentGatewaySettingsView({
  initialSettings,
  failed,
  canWrite,
}: PaymentGatewaySettingsViewProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<readonly AdminPaymentGatewaySetting[]>(
    initialSettings ?? [],
  );
  const [pendingProvider, setPendingProvider] = useState<AdminPaymentGatewayProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(
    () => ({
      configured: settings.filter((setting) => setting.isConfigured).length,
      enabled: settings.filter((setting) => setting.isEnabled).length,
      available: settings.filter((setting) => setting.isAvailable).length,
    }),
    [settings],
  );

  async function toggle(provider: AdminPaymentGatewayProvider) {
    const current = settings.find((setting) => setting.provider === provider);
    if (!current || pendingProvider) return;
    const nextEnabled = !current.isEnabled;
    setError(null);
    setMessage(null);
    setPendingProvider(provider);
    try {
      const response = await fetch(`/api/payment-gateways/${provider}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: nextEnabled }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(payload));
      const parsed = parsePaymentGatewaySettings([payload]);
      if (!parsed?.[0]) throw new Error('پاسخ سرویس درگاه معتبر نبود.');
      setSettings((items) =>
        items.map((setting) => (setting.provider === provider ? parsed[0] : setting)),
      );
      setMessage(
        nextEnabled
          ? `${current.displayName} برای پرداخت مشتری فعال شد.`
          : `${current.displayName} غیرفعال شد؛ پرداخت‌های در حال انجام همچنان قابل تأیید هستند.`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      setPendingProvider(null);
    }
  }

  if (failed || !initialSettings) {
    return (
      <Alert tone="danger" title="دریافت تنظیمات درگاه ناموفق بود" className="mt-6">
        ارتباط با سرویس پرداخت برقرار نشد. صفحه را دوباره بارگذاری کنید.
      </Alert>
    );
  }

  return (
    <div className="space-y-6 pt-6">
      <Alert tone="info" title="credentialها فقط روی سرور نگهداری می‌شوند">
        این صفحه فقط وضعیت پیکربندی را نمایش می‌دهد و هیچ Merchant ID، نام کاربری یا رمز عبوری را از
        API دریافت نمی‌کند. تغییر credential نیازمند به‌روزرسانی env و restart سرویس API است.
      </Alert>

      {error ? (
        <Alert tone="danger" title="ذخیره تنظیمات ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <section aria-label="خلاصه وضعیت درگاه‌ها" className="grid gap-3 sm:grid-cols-3">
        {[
          ['پیکربندی‌شده', totals.configured],
          ['فعال', totals.enabled],
          ['قابل استفاده', totals.available],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-4 shadow-[var(--admin-shadow-sm)]"
          >
            <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black">{formatAdminInteger(value as number)}</p>
          </div>
        ))}
      </section>

      <section aria-label="فهرست درگاه‌های پرداخت" className="grid gap-4 lg:grid-cols-3">
        {settings.map((setting) => (
          <GatewayCard
            key={setting.provider}
            setting={setting}
            canWrite={canWrite}
            pending={pendingProvider === setting.provider}
            onToggle={(provider) => void toggle(provider)}
          />
        ))}
      </section>
    </div>
  );
}
