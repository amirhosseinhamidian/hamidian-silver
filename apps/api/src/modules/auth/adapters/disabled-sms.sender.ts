import { ServiceUnavailableException } from '@nestjs/common';
import type { SendOtpMessage, SmsSender } from '../sms-sender.port';

export class DisabledSmsSender implements SmsSender {
  async sendOtp(_message: SendOtpMessage): Promise<void> {
    throw new ServiceUnavailableException('SMS delivery is not configured.');
  }
}
