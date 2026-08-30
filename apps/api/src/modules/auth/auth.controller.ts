import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@Controller('auth/otp')
export class AuthController {
  constructor(private readonly otpService: OtpService) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(@Body() dto: RequestOtpDto) {
    return this.otpService.requestCode(dto.phone);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyCode(dto.phone, dto.code);
  }
}
