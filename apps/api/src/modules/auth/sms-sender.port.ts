export const SMS_SENDER = Symbol('SMS_SENDER');

export type SendOtpMessage = {
  phone: string;
  code: string;
};

export interface SmsSender {
  sendOtp(message: SendOtpMessage): Promise<void>;
}
