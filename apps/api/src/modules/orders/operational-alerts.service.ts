import { Injectable } from '@nestjs/common';
import {
  type EnqueueOperationalAlertInput,
  OperationalAlertOutboxService,
} from '../notifications/operational-alert-outbox.service';
import { buildOperationalAlertCandidates, isOperationalAlertItem } from './operational-alerts';
import { OperationalIncidentsService } from './operational-incidents.service';
import { OperationsWorkQueueService } from './operations-work-queue.service';

@Injectable()
export class OperationalAlertsService {
  constructor(
    private readonly workQueue: OperationsWorkQueueService,
    private readonly outbox: OperationalAlertOutboxService,
    private readonly incidents: OperationalIncidentsService,
  ) {}

  async scan(now = new Date()) {
    const items = await this.workQueue.snapshot(now);
    const alertItems = items.filter(isOperationalAlertItem);
    const incidentSync = await this.incidents.syncFromWorkItems(alertItems, now);
    const candidates: EnqueueOperationalAlertInput[] = alertItems.flatMap((item) =>
      buildOperationalAlertCandidates(item, now),
    );
    const enqueue = await this.outbox.enqueueMany(candidates);

    return {
      scannedAt: now,
      activeIncidentCount: alertItems.length,
      incidentSync,
      ...enqueue,
    };
  }

  async summary(now = new Date()) {
    const items = (await this.workQueue.snapshot(now)).filter(isOperationalAlertItem);
    const delivery = await this.outbox.deliverySummary();
    const byCode = Object.fromEntries(
      [...new Set(items.map((item) => item.code))].map((code) => [
        code,
        items.filter((item) => item.code === code).length,
      ]),
    );

    return {
      generatedAt: now,
      activeIncidentCount: items.length,
      critical: items.filter((item) => item.priority === 'CRITICAL').length,
      overdue: items.filter((item) => item.state === 'OVERDUE').length,
      reconciliationRequired: items.filter(
        (item) => item.code === 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
      ).length,
      byCode,
      delivery,
    };
  }
}
