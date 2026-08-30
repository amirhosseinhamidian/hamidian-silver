import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthController } from './auth.controller';
import { OtpCodeGenerator } from './otp-code-generator';
import { OtpService } from './otp.service';
import { smsSenderProvider } from './sms-sender.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [OtpCodeGenerator, OtpService, smsSenderProvider],
})
export class AuthModule {}
