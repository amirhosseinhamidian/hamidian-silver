import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { AuthService } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Get('me')
  getCurrentUser(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.authService.getCurrentUser(principal);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    await this.authService.logout(principal.sessionId);
  }
}
