import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleSmsSender } from './adapters/console-sms.sender';
import { DisabledSmsSender } from './adapters/disabled-sms.sender';
import { KavenegarSmsSender } from './adapters/kavenegar-sms.sender';
import { SMS_SENDER, type SmsSender } from './sms-sender.port';

export const smsSenderProvider: Provider = {
  provide: SMS_SENDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): SmsSender => {
    const provider = configService.get<string>('SMS_PROVIDER', 'disabled');

    if (provider === 'kavenegar') {
      return new KavenegarSmsSender(configService);
    }

    if (provider === 'console') {
      return new ConsoleSmsSender(configService.get<string>('NODE_ENV', 'development'));
    }

    return new DisabledSmsSender();
  },
};
