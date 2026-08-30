import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { OtpService } from './otp.service';

describe('AuthController', () => {
  let controller: AuthController;

  const otpService = {
    requestCode: jest.fn(),
    verifyCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: OtpService,
          useValue: otpService,
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('requests an OTP challenge', async () => {
    const result = {
      challengeId: '10000000-0000-4000-8000-000000000001',
      expiresAt: new Date('2026-08-30T12:00:00.000Z'),
    };

    otpService.requestCode.mockResolvedValue(result);

    await expect(controller.requestCode({ phone: '09123456789' })).resolves.toEqual(result);
    expect(otpService.requestCode).toHaveBeenCalledWith('09123456789');
  });

  it('verifies an OTP code', async () => {
    otpService.verifyCode.mockResolvedValue({
      phone: '+989123456789',
    });

    await expect(
      controller.verifyCode({
        phone: '09123456789',
        code: '123456',
      }),
    ).resolves.toEqual({
      phone: '+989123456789',
    });

    expect(otpService.verifyCode).toHaveBeenCalledWith('09123456789', '123456');
  });
});
