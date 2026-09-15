import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { AuthService } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import {
  CurrentUserResponseDto,
  LoginResponseDto,
  OtpRequestResponseDto,
} from './dto/auth-response.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: OtpRequestResponseDto })
  requestCode(@Body() dto: RequestOtpDto): Promise<OtpRequestResponseDto> {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  verifyCode(@Body() dto: VerifyOtpDto): Promise<LoginResponseDto> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CurrentUserResponseDto })
  getCurrentUser(@CurrentPrincipal() principal: AuthenticatedPrincipal): CurrentUserResponseDto {
    return this.authService.getCurrentUser(principal);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async logout(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    await this.authService.logout(principal.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async logoutAll(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    await this.authService.logoutAll(principal.userId);
  }
}
