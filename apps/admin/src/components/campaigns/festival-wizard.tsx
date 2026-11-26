import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { RetryButton } from '@/components/ui/retry-button';
import type { createAdminApiClient } from '@/lib/auth/server-api';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { festivalStepHref, type FestivalStep } from '@/lib/campaigns/festival-wizard';
import { CampaignBudgetReview } from './campaign-budget-review';
import { CampaignDetailView } from './campaign-detail-view';
import { CampaignEditor } from './campaign-editor';
import { CampaignLandingEditor } from './campaign-landing-editor';
import { CampaignSalesPanel } from './campaign-sales-panel';
import { FestivalPublicationRestore } from './festival-publication-restore';
import { FestivalWizardNavigation } from './festival-wizard-navigation';
import { FestivalWorkspace } from './festival-workspace';

export async function FestivalWizard({
  campaign,
  client,
  accountId,
  step,
  canWrite,
  canReadOperations,
  canReadFinance,
}: {
  campaign: CampaignDetail;
  client: ReturnType<typeof createAdminApiClient>;
  accountId: string;
  step: FestivalStep;
  canWrite: boolean;
  canReadOperations: boolean;
  canReadFinance: boolean;
}) {
  const { id, name, revision } = campaign;
  const canEdit = canWrite && campaign.status === 'DRAFT';
  const params = { path: { id } };
  const designStep =
    step === 'theme' || step === 'placements' || step === 'landing' || step === 'preview';
  const [promotion, landing, festival] = await Promise.all([
    step === 'promotion' || step === 'preview' || step === 'review'
      ? client
          .GET('/api/v1/promotions/{campaignId}', {
            params: { path: { campaignId: id } },
            cache: 'no-store',
          })
          .catch(() => null)
      : null,
    designStep || step === 'products' || step === 'review'
      ? client
          .GET('/api/v1/campaigns/{id}/landing', { params, cache: 'no-store' })
          .catch(() => null)
      : null,
    designStep
      ? client.GET('/api/v1/campaigns/{id}/design', { params, cache: 'no-store' }).catch(() => null)
      : null,
  ]);
  const landingEditor = landing?.data;
  const design = festival?.data;
  const rule = promotion?.data?.rule;
  const budget = (
    <CampaignBudgetReview
      key={`budget-${id}-${revision}`}
      campaign={campaign}
      rule={rule ?? null}
    />
  );
  const campaignEditor = (view: 'basics' | 'products' | 'promotion' | 'placements') => (
    <CampaignEditor
      key={`${id}-${revision}-${view}`}
      campaign={campaign}
      view={view}
      canWrite={canEdit}
    />
  );
  const landingError = (
    <Alert tone="danger" action={<RetryButton />}>
      دریافت تنظیمات لندینگ ممکن نشد.
    </Alert>
  );
  const noLanding = (
    <Alert
      tone="info"
      action={
        <ButtonLink href={festivalStepHref(id, 'products')} size="sm" variant="outline">
          محصولات و مجموعه
        </ButtonLink>
      }
    >
      {canEdit
        ? 'ابتدا صفحه و مجموعهٔ جشنواره را در مرحلهٔ محصولات ذخیره کنید.'
        : 'برای این جشنواره هنوز صفحه و مجموعه‌ای ذخیره نشده است.'}
    </Alert>
  );

  let panel;
  switch (step) {
    case 'basics':
      panel = campaignEditor('basics');
      break;
    case 'products':
      panel = (
        <>
          {campaignEditor('products')}
          {landingEditor ? (
            <CampaignLandingEditor
              key={`collection-${id}-${landingEditor.revision}`}
              campaign={campaign}
              editor={landingEditor}
              canWrite={canWrite}
              view="collection"
            />
          ) : (
            landingError
          )}
        </>
      );
      break;
    case 'promotion':
      panel = (
        <>
          {campaignEditor('promotion')}
          <CampaignSalesPanel
            campaign={campaign}
            rule={rule}
            rateTargets={promotion?.data?.rateTargets}
            canWrite={canWrite}
          />
        </>
      );
      break;
    case 'review':
      panel = (
        <>
          {landingEditor && Boolean(landingEditor.publishedVersions?.length) && (
            <FestivalPublicationRestore
              campaignId={id}
              revision={landingEditor.revision}
              versions={landingEditor.publishedVersions ?? []}
              editable={canEdit}
            />
          )}
          {!landingEditor && landingError}
          {landingEditor && !landingEditor.landing && noLanding}
          {!promotion?.data && (
            <Alert tone="danger" action={<RetryButton />}>
              دریافت قانون تخفیف ممکن نشد.
            </Alert>
          )}
          <CampaignDetailView key={`${id}-${revision}`} campaign={campaign} canWrite={canWrite} />
        </>
      );
      break;
    default: {
      const view = step === 'landing' ? 'sections' : step;
      panel = (
        <>
          {step === 'placements' && campaignEditor('placements')}
          {!landingEditor ? (
            landingError
          ) : !landingEditor.landing ? (
            noLanding
          ) : design ? (
            <FestivalWorkspace
              key={`${id}-${view}-${landingEditor.revision}-${design.revision}`}
              campaign={campaign}
              landing={landingEditor}
              festival={design}
              canWrite={canWrite}
              view={view}
            />
          ) : (
            <>
              <Alert tone="danger" action={<RetryButton />}>
                دریافت طرح جشنواره ممکن نشد.
              </Alert>
              {step === 'placements' && (
                <CampaignLandingEditor
                  campaign={campaign}
                  editor={landingEditor}
                  canWrite={canWrite}
                  view="placements"
                />
              )}
            </>
          )}
          {step === 'preview' && (
            <>
              {landingEditor?.landing && (
                <CampaignLandingEditor
                  campaign={campaign}
                  editor={landingEditor}
                  canWrite={false}
                  view="collection"
                />
              )}
              {promotion?.data ? (
                budget
              ) : (
                <Alert tone="danger" action={<RetryButton />}>
                  دریافت قانون تخفیف ممکن نشد.
                </Alert>
              )}
            </>
          )}
        </>
      );
    }
  }

  return (
    <>
      <FestivalWizardNavigation
        id={id}
        accountId={accountId}
        name={name}
        step={step}
        remember={canEdit}
      />
      {(canReadOperations || canReadFinance) && (
        <div className="flex flex-wrap gap-2">
          {canReadOperations && (
            <ButtonLink href={`/campaigns?id=${id}&step=operations`} variant="outline" size="sm">
              مرکز عملیات
            </ButtonLink>
          )}
          {canReadFinance && (
            <ButtonLink href={`/growth/festivals/${id}`} variant="outline" size="sm">
              گزارش عملکرد
            </ButtonLink>
          )}
        </div>
      )}
      {panel}
    </>
  );
}
