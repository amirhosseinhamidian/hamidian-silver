import { Logger } from '@nestjs/common';
import type { SendOtpMessage, SendSmsMessage, SmsSender } from '../sms-sender.port';

export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  constructor(nodeEnvironment: string) {
    if (nodeEnvironment === 'production') {
      throw new Error('Console SMS delivery cannot be used in production.');
    }
  }

  async sendOtp(message: SendOtpMessage): Promise<void> {
    this.logger.log(`[LOCAL OTP] phone=${message.phone} code=${message.code}`);
  }

  async sendMessage(message: SendSmsMessage): Promise<void> {
    this.logger.log(`[LOCAL SMS] phone=${message.phone} message=${message.text}`);
  }
}
