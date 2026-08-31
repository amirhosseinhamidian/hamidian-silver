import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AddOperationalIncidentNoteDto } from './dto/add-operational-incident-note.dto';
import { AssignOperationalIncidentDto } from './dto/assign-operational-incident.dto';
import { ListOperationalIncidentsQueryDto } from './dto/list-operational-incidents-query.dto';
import { OperationalIncidentsService } from './operational-incidents.service';

@Controller('operations/incidents')
export class OperationalIncidentsController {
  constructor(private readonly operationalIncidentsService: OperationalIncidentsService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  list(
    @Query() query: ListOperationalIncidentsQueryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.operationalIncidentsService.list(query, principal.userId);
  }

  @Get(':incidentId')
  @RequirePermissions(PERMISSION_CODES.ORDERS_READ)
  get(
    @Param('incidentId', new ParseUUIDPipe({ version: '4' }))
    incidentId: string,
  ) {
    return this.operationalIncidentsService.get(incidentId);
  }

  @Post(':incidentId/acknowledge')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  acknowledge(
    @Param('incidentId', new ParseUUIDPipe({ version: '4' }))
    incidentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.operationalIncidentsService.acknowledge(incidentId, principal.userId);
  }

  @Post(':incidentId/assign')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  assign(
    @Param('incidentId', new ParseUUIDPipe({ version: '4' }))
    incidentId: string,
    @Body() dto: AssignOperationalIncidentDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.operationalIncidentsService.assign(incidentId, dto, principal.userId);
  }

  @Post(':incidentId/unassign')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  unassign(
    @Param('incidentId', new ParseUUIDPipe({ version: '4' }))
    incidentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.operationalIncidentsService.unassign(incidentId, principal.userId);
  }

  @Post(':incidentId/notes')
  @RequirePermissions(PERMISSION_CODES.ORDERS_STATUS_WRITE)
  addNote(
    @Param('incidentId', new ParseUUIDPipe({ version: '4' }))
    incidentId: string,
    @Body() dto: AddOperationalIncidentNoteDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.operationalIncidentsService.addNote(incidentId, dto, principal.userId);
  }
}
