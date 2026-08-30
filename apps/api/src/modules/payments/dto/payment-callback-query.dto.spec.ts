import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentCallbackQueryDto } from './payment-callback-query.dto';

describe('PaymentCallbackQueryDto', () => {
  it('normalizes Zarinpal Authority casing for the controller', async () => {
    const dto = plainToInstance(PaymentCallbackQueryDto, {
      Authority: 'A000000000000000000000000000000000001',
      Status: 'OK',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.authority).toBe('A000000000000000000000000000000000001');
  });

  it('still accepts the lowercase internal callback shape', async () => {
    const dto = plainToInstance(PaymentCallbackQueryDto, {
      authority: 'AUTH-1',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.authority).toBe('AUTH-1');
  });
});
