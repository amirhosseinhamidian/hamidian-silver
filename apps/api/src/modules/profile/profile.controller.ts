import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.profileService.getProfile(principal.userId);
  }

  @Patch()
  updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(principal.userId, dto);
  }

  @Get('addresses')
  listAddresses(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.profileService.listAddresses(principal.userId);
  }

  @Post('addresses')
  createAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateUserAddressDto,
  ) {
    return this.profileService.createAddress(principal.userId, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
    @Body() dto: UpdateUserAddressDto,
  ) {
    return this.profileService.updateAddress(principal.userId, addressId, dto);
  }

  @Patch('addresses/:addressId/default')
  setDefaultAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
  ) {
    return this.profileService.setDefaultAddress(principal.userId, addressId);
  }

  @Delete('addresses/:addressId')
  deleteAddress(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string,
  ) {
    return this.profileService.deleteAddress(principal.userId, addressId);
  }
}
