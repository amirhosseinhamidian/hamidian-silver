import type { components } from '@hamidian/contracts';

import { Alert } from '@/components/ui/alert';
import { RetryButton } from '@/components/ui/retry-button';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { CampaignProductPricePreview } from './campaign-product-price-preview';
import { CampaignPromotionEditor } from './campaign-promotion-editor';
import { CampaignQuotaEditor } from './campaign-quota-editor';

export function CampaignSalesPanel({
  campaign,
  rule,
  canWrite,
}: {
  campaign: CampaignDetail;
  rule: components['schemas']['SavePromotionDto'] | null | undefined;
  canWrite: boolean;
}) {
  if (rule === undefined) {
    return (
      <Alert tone="danger" action={<RetryButton />}>
        دریافت قانون تخفیف ممکن نشد.
      </Alert>
    );
  }

  return (
    <>
      <CampaignPromotionEditor
        key={`promotion-${campaign.id}-${rule?.expectedVersion ?? 0}`}
        id={campaign.id}
        rule={rule}
        editable={canWrite && campaign.status === 'DRAFT'}
      />
      <CampaignQuotaEditor
        key={`quota-${campaign.id}`}
        campaignId={campaign.id}
        canWrite={canWrite}
        canAdd={['DRAFT', 'APPROVED', 'SCHEDULED'].includes(campaign.status)}
      />
      <CampaignProductPricePreview
        key={`prices-${campaign.id}-${campaign.revision}`}
        campaignId={campaign.id}
      />
    </>
  );
}
