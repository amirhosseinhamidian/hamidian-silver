import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../authorization/rbac.constants';
import { AdminRoleManagementSnapshotDto } from './dto/admin-role-management.dto';
import { UpdateAdminRolePermissionsDto } from './dto/update-admin-role-permissions.dto';
import { UserManagementService } from './user-management.service';

@Controller({ path: 'admin-roles', version: '1' })
export class AdminRoleManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.USERS_READ)
  @ApiOkResponse({ type: AdminRoleManagementSnapshotDto })
  list() {
    return this.userManagementService.listRoles();
  }

  @Put(':roleCode/permissions')
  @RequirePermissions(PERMISSION_CODES.USERS_WRITE)
  @ApiOkResponse({ type: AdminRoleManagementSnapshotDto })
  updatePermissions(
    @Param('roleCode') roleCode: string,
    @Body() dto: UpdateAdminRolePermissionsDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ) {
    return this.userManagementService.updateRolePermissions(roleCode, dto, principal.roleCodes);
  }
}
