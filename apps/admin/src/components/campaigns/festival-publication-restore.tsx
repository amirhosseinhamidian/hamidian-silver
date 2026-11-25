'use client';

import type { components } from '@hamidian/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';

export function FestivalPublicationRestore({
  campaignId,
  revision,
  versions,
  editable,
}: {
  campaignId: string;
  revision: number;
  versions: readonly components['schemas']['FestivalPublishedVersionDto'][];
  editable: boolean;
}) {
  const router = useRouter();
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (
      !editable ||
      !version ||
      busy ||
      !window.confirm('تنظیمات نسخهٔ انتخاب‌شده جایگزین پیش‌نویس فعلی شوند؟')
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/landing/restore-publication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, version: Number(version) }),
      });
      if (!response.ok) throw new Error(await campaignError(response));
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'بازگردانی نسخه انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="نسخه‌های منتشرشده">
      <div className="space-y-3">
        <p className="text-sm">
          {editable
            ? 'نسخهٔ انتخاب‌شده در پیش‌نویس بازیابی می‌شود. انتشار از مرحلهٔ تأیید انجام می‌شود.'
            : 'بازگردانی نسخه در وضعیت پیش‌نویس در دسترس است.'}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 gap-1 text-sm">
            نسخهٔ انتشار
            <select
              value={version}
              disabled={busy}
              onChange={(event) => setVersion(event.currentTarget.value)}
              className="min-h-10 rounded-md border border-[var(--admin-color-border)] px-2"
            >
              <option value="">انتخاب نسخه</option>
              {versions.map((item) => (
                <option key={item.version} value={item.version}>
                  نسخهٔ {formatAdminInteger(item.version)} · {formatAdminDateTime(item.recordedAt)}
                </option>
              ))}
            </select>
          </label>
          {editable && (
            <Button disabled={!version} loading={busy} onClick={() => void restore()}>
              بازگردانی در پیش‌نویس
            </Button>
          )}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Card>
  );
}
