import type { SeoIssueSeverity, SeoIssueStatus } from '../../../generated/prisma/enums';
import { issueDayMs, type IssueSignal } from './seo-issue-signals';

const rank: Record<SeoIssueSeverity, number> = { REVIEW: 0, IMPORTANT: 1, CRITICAL: 2 };

type PriorIssue = {
  status: SeoIssueStatus;
  severity: SeoIssueSeverity;
  active: boolean;
  observedAt: Date;
  lastQueuedAt: Date | null;
};

export function issueTransition(previous: PriorIssue | undefined, signal: IssueSignal, now: Date) {
  if (!previous && !signal.active) return null;
  if (previous && signal.observedAt <= previous.observedAt) return null;
  if (previous && !previous.active && !signal.active) return null;
  const escalated = previous && rank[signal.evidence.severity] > rank[previous.severity];
  const kind = !previous
    ? 'DETECTED'
    : !signal.active
      ? 'CLEARED'
      : !previous.active
        ? 'RETURNED'
        : previous.severity !== signal.evidence.severity
          ? 'SEVERITY_CHANGED'
          : null;
  const status =
    kind === 'RETURNED' ||
    (kind === 'SEVERITY_CHANGED' && escalated && previous?.status === 'RESOLVED')
      ? 'OPEN'
      : (previous?.status ?? 'OPEN');
  const canNotify =
    !previous?.lastQueuedAt ||
    now.getTime() - previous.lastQueuedAt.getTime() >= issueDayMs ||
    (kind === 'SEVERITY_CHANGED' && escalated);
  return {
    kind,
    status,
    notify: Boolean(kind && canNotify && signal.active && signal.evidence.severity === 'CRITICAL'),
  };
}
