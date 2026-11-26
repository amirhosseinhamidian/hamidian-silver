'use client';

import type { components } from '@hamidian/contracts';
import { useState } from 'react';
import type { CampaignDetail } from '@/lib/campaigns/campaign-model';
import { CampaignLandingEditor } from './campaign-landing-editor';
import { FestivalDesigner, initialFestivalDesign } from './festival-designer';
import { FestivalLivePreview } from './festival-live-preview';
import { FestivalPublicationRestore } from './festival-publication-restore';

export function FestivalWorkspace({
  campaign,
  landing,
  festival,
  canWrite,
  view = 'all',
}: {
  campaign: CampaignDetail;
  landing: components['schemas']['CampaignLandingEditorDto'];
  festival: components['schemas']['FestivalDesignEditorDto'];
  canWrite: boolean;
  view?: 'all' | 'theme' | 'placements' | 'sections' | 'preview';
}) {
  const [landingDraft, setLandingDraft] = useState(landing.landing);
  const [designDraft, setDesignDraft] = useState<typeof festival.design>(() =>
    initialFestivalDesign(festival),
  );
  return (
    <>
      <FestivalLivePreview
        campaignId={campaign.id}
        draft={landingDraft && designDraft ? { ...designDraft, landing: landingDraft } : null}
      />
      {view === 'all' && Boolean(landing.publishedVersions?.length) && (
        <FestivalPublicationRestore
          campaignId={campaign.id}
          revision={landing.revision}
          versions={landing.publishedVersions ?? []}
          editable={canWrite && campaign.status === 'DRAFT'}
        />
      )}
      {(view === 'all' || view === 'placements' || view === 'sections') && (
        <CampaignLandingEditor
          campaign={campaign}
          editor={landing}
          canWrite={canWrite}
          onPreviewChange={setLandingDraft}
          view={view === 'sections' ? 'details' : view}
        />
      )}
      {(view === 'all' || view === 'theme' || view === 'sections') && (
        <FestivalDesigner
          campaignId={campaign.id}
          editor={festival}
          editable={canWrite && campaign.status === 'DRAFT'}
          onPreviewChange={setDesignDraft}
          view={view}
        />
      )}
    </>
  );
}
