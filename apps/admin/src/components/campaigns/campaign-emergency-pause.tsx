'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';

export function CampaignEmergencyPause({
  campaign,
}: {
  campaign: { id: string; revision: number };
}) {
  const router = useRouter();
  const request = useRef<string>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function pause() {
    if (
      busy ||
      submitted ||
      !window.confirm('نمایش عمومی کمپین و اعمال پیشنهاد آن موقتاً متوقف شود؟')
    )
      return;
    request.current ??= crypto.randomUUID();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PAUSE',
          expectedRevision: campaign.revision,
          requestId: request.current,
        }),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError('وضعیت توقف مشخص نیست. دوباره تلاش کنید یا صفحه را تازه کنید.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        loading={busy}
        disabled={submitted}
        onClick={() => void pause()}
      >
        توقف اضطراری
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      {submitted && (
        <span role="status" className="text-sm">
          توقف ثبت شد.
        </span>
      )}
    </>
  );
}
