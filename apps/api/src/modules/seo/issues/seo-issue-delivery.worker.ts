import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { NotificationOutboxStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import { AdminMessageSender } from '../../notifications/admin-message.sender';
import { auditOrigin } from '../audit/seo-audit-crawl';
import { seoStaff, SeoIssueService } from './seo-issue.service';

@Injectable()
export class SeoIssueDeliveryWorker {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Inject(AdminMessageSender) private readonly sender: Pick<AdminMessageSender, 'send'>,
    private readonly issues: SeoIssueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'seo-issue-telegram', waitForCompletion: true })
  async tick() {
    const scope = this.issues.scope;
    if (!scope || !this.config.get<boolean>('SEO_ISSUES_TELEGRAM_ENABLED')) return;
    const adminOrigin = auditOrigin(this.config.get<string>('ADMIN_APP_ORIGIN'));
    const relay = this.config.get<string>('TELEGRAM_RELAY_URL');
    const secret = this.config.get<string>('TELEGRAM_RELAY_SECRET');
    const configured =
      relay || secret ? relay && secret : this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!adminOrigin || !configured) return;
    const now = new Date();
    await this.db.seoIssueDelivery.updateMany({
      where: { status: 'DISPATCHING', claimedAt: { lte: new Date(now.getTime() - 120_000) } },
      data: { status: 'UNKNOWN', finishedAt: now },
    });
    const pending = await this.db.seoIssueDelivery.findMany({
      where: { status: 'PENDING', event: { issue: scope } },
      take: 10,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, recipientId: true, event: { select: { issueId: true } } },
    });
    for (const delivery of pending) {
      const recipient = await this.db.adminMessageRecipient.findFirst({
        where: { userId: delivery.recipientId, user: seoStaff(PERMISSION_CODES.SETTINGS_READ) },
        select: { telegramChatId: true },
      });
      const claimedAt = new Date();
      const claim = await this.db.seoIssueDelivery.updateMany({
        where: { id: delivery.id, status: 'PENDING' },
        data: { claimedAt, status: 'DISPATCHING' },
      });
      if (!claim.count) continue;
      let status: NotificationOutboxStatus = 'SKIPPED';
      if (recipient?.telegramChatId) {
        const link = new URL(`/seo/issues/${delivery.event.issueId}`, adminOrigin).href;
        try {
          await this.sender.send(
            'TELEGRAM',
            recipient.telegramChatId,
            `هشدار بحرانی سئو در پنل گالری حمیدیان\n${link}`,
          );
          status = 'SENT';
        } catch {
          status = 'UNKNOWN';
        }
      }
      await this.db.seoIssueDelivery.updateMany({
        where: { id: delivery.id, status: 'DISPATCHING', claimedAt },
        data: { status, finishedAt: new Date() },
      });
    }
  }
}
