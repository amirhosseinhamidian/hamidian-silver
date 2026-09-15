import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import {
  AdminManagedUserDto,
  AdminUserManagementSnapshotDto,
  RevokeAdminUserSessionsResultDto,
} from './dto/admin-user-management.dto';
import { UpdateAdminUserRolesDto } from './dto/update-admin-user-roles.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';
import { UserManagementService } from './user-management.service';

@Controller({ path: 'admin-users', version: '1' })
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.USERS_READ)
  @ApiOkResponse({ type: AdminUserManagementSnapshotDto })
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.userManagementService.list(query);
  }

  @Patch(':userId/status')
  @RequirePermissions(PERMISSION_CODES.USERS_WRITE)
  @ApiOkResponse({ type: AdminManagedUserDto })
  updateStatus(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateAdminUserStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.userManagementService.updateStatus(userId, principal.userId, dto);
  }

  @Put(':userId/roles')
  @RequirePermissions(PERMISSION_CODES.USERS_WRITE)
  @ApiOkResponse({ type: AdminManagedUserDto })
  updateRoles(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateAdminUserRolesDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.userManagementService.updateRoles(userId, principal.userId, dto);
  }

  @Post(':userId/sessions/revoke')
  @RequirePermissions(PERMISSION_CODES.USERS_WRITE)
  @ApiOkResponse({ type: RevokeAdminUserSessionsResultDto })
  revokeSessions(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.userManagementService.revokeSessions(userId, principal.userId);
  }
}
