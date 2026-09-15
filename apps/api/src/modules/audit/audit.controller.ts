import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AuditService } from './audit.service';
import { AuditLogSnapshotDto } from './dto/audit-log.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.AUDIT_READ)
  @ApiOkResponse({ type: AuditLogSnapshotDto })
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
