import { OtpCodeGenerator } from './otp-code-generator';

describe('OtpCodeGenerator', () => {
  it('generates a five-digit numeric code', () => {
    const generator = new OtpCodeGenerator();

    expect(generator.generate()).toMatch(/^\d{5}$/);
  });
});
