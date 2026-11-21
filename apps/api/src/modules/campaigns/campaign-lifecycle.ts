import type { CampaignStatus } from '../../generated/prisma/enums';

export const CampaignAction = {
  APPROVE: 'APPROVE',
  SCHEDULE: 'SCHEDULE',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  REOPEN: 'REOPEN',
  END: 'END',
} as const;

export type CampaignAction = (typeof CampaignAction)[keyof typeof CampaignAction];

const transitions: Record<CampaignAction, { from: readonly CampaignStatus[]; to: CampaignStatus }> =
  {
    APPROVE: { from: ['DRAFT'], to: 'APPROVED' },
    SCHEDULE: { from: ['APPROVED'], to: 'SCHEDULED' },
    PAUSE: { from: ['SCHEDULED', 'ACTIVE'], to: 'PAUSED' },
    RESUME: { from: ['PAUSED'], to: 'SCHEDULED' },
    REOPEN: { from: ['APPROVED', 'PAUSED'], to: 'DRAFT' },
    END: { from: ['APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED'], to: 'ENDED' },
  };

export function campaignTransition(current: CampaignStatus, action: CampaignAction) {
  const { from, to } = transitions[action];
  return current === to || from.includes(current) ? to : null;
}
