'use client';

import type { components } from '@hamidian/contracts';
import { useState } from 'react';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { CampaignLandingEditor } from './campaign-landing-editor';
import { FestivalDesigner } from './festival-designer';
import { FestivalLivePreview } from './festival-live-preview';
import { FestivalPublicationRestore } from './festival-publication-restore';

export function FestivalWorkspace({
  campaign,
  landing,
  festival,
  canWrite,
}: {
  campaign: CampaignDetail;
  landing: components['schemas']['CampaignLandingEditorDto'];
  festival: components['schemas']['FestivalDesignEditorDto'];
  canWrite: boolean;
}) {
  const [landingDraft, setLandingDraft] = useState(landing.landing);
  const [designDraft, setDesignDraft] = useState(festival.design);
  return (
    <>
      <FestivalLivePreview
        campaignId={campaign.id}
        draft={landingDraft && designDraft ? { ...designDraft, landing: landingDraft } : null}
      />
      {Boolean(landing.publishedVersions?.length) && (
        <FestivalPublicationRestore
          campaignId={campaign.id}
          revision={landing.revision}
          versions={landing.publishedVersions ?? []}
          editable={canWrite && campaign.status === 'DRAFT'}
        />
      )}
      <CampaignLandingEditor
        campaign={campaign}
        editor={landing}
        canWrite={canWrite}
        onPreviewChange={setLandingDraft}
      />
      <FestivalDesigner
        campaignId={campaign.id}
        editor={festival}
        editable={canWrite && campaign.status === 'DRAFT'}
        onPreviewChange={setDesignDraft}
      />
    </>
  );
}
