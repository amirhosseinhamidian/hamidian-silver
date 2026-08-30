import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticationGuard } from './authentication.guard';
import { OtpCodeGenerator } from './otp-code-generator';
import { OtpService } from './otp.service';
import { SMS_SENDER } from './sms-sender.port';
import { smsSenderProvider } from './sms-sender.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthenticationGuard, OtpCodeGenerator, OtpService, smsSenderProvider],
  exports: [AuthService, AuthenticationGuard, SMS_SENDER],
})
export class AuthModule {}
