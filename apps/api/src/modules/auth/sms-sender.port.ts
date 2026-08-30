export const SMS_SENDER = Symbol('SMS_SENDER');

export type SendOtpMessage = {
  phone: string;
  code: string;
};

export type SendSmsMessage = {
  phone: string;
  text: string;
};

export interface SmsSender {
  sendOtp(message: SendOtpMessage): Promise<void>;
  sendMessage?(message: SendSmsMessage): Promise<void>;
}
