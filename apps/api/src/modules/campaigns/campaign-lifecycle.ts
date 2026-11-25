import type { CampaignStatus } from '../../generated/prisma/enums';

export const CampaignAction = {
  APPROVE: 'APPROVE',
  SCHEDULE: 'SCHEDULE',
  PUBLISH_NOW: 'PUBLISH_NOW',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  REOPEN: 'REOPEN',
  END: 'END',
  ARCHIVE: 'ARCHIVE',
} as const;

export type CampaignAction = (typeof CampaignAction)[keyof typeof CampaignAction];

const transitions: Record<
  Exclude<CampaignAction, 'ARCHIVE'>,
  { from: readonly CampaignStatus[]; to: CampaignStatus }
> = {
  APPROVE: { from: ['DRAFT'], to: 'APPROVED' },
  SCHEDULE: { from: ['APPROVED'], to: 'SCHEDULED' },
  PUBLISH_NOW: { from: ['APPROVED', 'SCHEDULED'], to: 'ACTIVE' },
  PAUSE: { from: ['SCHEDULED', 'ACTIVE'], to: 'PAUSED' },
  RESUME: { from: ['PAUSED'], to: 'SCHEDULED' },
  REOPEN: { from: ['APPROVED', 'PAUSED'], to: 'DRAFT' },
  END: { from: ['APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED'], to: 'ENDED' },
};

export function campaignTransition(
  current: CampaignStatus,
  action: Exclude<CampaignAction, 'ARCHIVE'>,
) {
  const { from, to } = transitions[action];
  return current === to || from.includes(current) ? to : null;
}
