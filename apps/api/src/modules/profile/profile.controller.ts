import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';
import {
  CustomerAddressDto,
  CustomerProfileDto,
  DeletedCustomerAddressDto,
} from './dto/customer-profile-response.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOkResponse({ type: CustomerProfileDto })
  getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.profileService.getProfile(principal.userId);
  }

  @Patch()
  @ApiOkResponse({ type: CustomerProfileDto })
  updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(principal.userId, dto);
  }

  @Get('addresses')
  @ApiOkResponse({ type: CustomerAddressDto, isArray: true })
  listAddresses(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.profileService.listAddresses(principal.userId);
  }

  @Post('addresses')
  @ApiCreatedResponse({ type: CustomerAddressDto })
  createAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateUserAddressDto,
  ) {
    return this.profileService.createAddress(principal.userId, dto);
  }

  @Patch('addresses/:addressId')
  @ApiOkResponse({ type: CustomerAddressDto })
  updateAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
    @Body() dto: UpdateUserAddressDto,
  ) {
    return this.profileService.updateAddress(principal.userId, addressId, dto);
  }

  @Patch('addresses/:addressId/default')
  @ApiOkResponse({ type: CustomerAddressDto })
  setDefaultAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
  ) {
    return this.profileService.setDefaultAddress(principal.userId, addressId);
  }

  @Delete('addresses/:addressId')
  @ApiOkResponse({ type: DeletedCustomerAddressDto })
  deleteAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
  ) {
    return this.profileService.deleteAddress(principal.userId, addressId);
  }
}
