import { Logger } from '@nestjs/common';
import { ConsoleSmsSender } from './console-sms.sender';

describe('ConsoleSmsSender', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the local OTP without contacting an external provider', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const sender = new ConsoleSmsSender('development');

    await sender.sendOtp({
      phone: '+989123456789',
      code: '12345',
    });

    expect(log).toHaveBeenCalledWith('[LOCAL OTP] phone=+989123456789 code=12345');
  });

  it('cannot be initialized in production', () => {
    expect(() => new ConsoleSmsSender('production')).toThrow(
      'Console SMS delivery cannot be used in production.',
    );
  });
});
